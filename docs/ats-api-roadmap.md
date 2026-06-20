# ATS API Roadmap

Este documento define a trilha de implementacao da API do ATS. A API Nest deve ser a fonte de verdade do produto; o servico Python/FastAPI deve executar IA de forma assincrona; RabbitMQ deve transportar jobs e resultados; PostgreSQL com pgvector deve manter dados transacionais, embeddings e historico.

## 1. Principios de arquitetura

1. A API Nest controla autenticacao, autorizacao, regras de negocio, limites por plano, contratos HTTP e estado principal.
2. O worker Python nao decide regra de negocio do ATS. Ele processa tarefas de IA e devolve resultados.
3. Toda acao importante deve ser rastreavel por auditoria e, quando necessario, por evento.
4. Operacoes pesadas devem ser assincronas: parsing de curriculo, embeddings, match e resumos.
5. O sistema deve crescer por modulos de dominio, nao por controllers soltos.
6. RabbitMQ deve ser tratado como transporte. O dominio nao deve depender diretamente dele.
7. A integracao assincrona deve ser idempotente para suportar retries sem duplicar efeitos.
8. Planos devem limitar uso, mas a implementacao deve permitir adicionar novos limites sem refatorar o produto inteiro.

## 2. Estado atual do banco

O schema atual ja cobre os blocos principais:

- Auth e multi-tenant: `user`, `session`, `account`, `organization`, `organization_profile`, `member`, `invitation`.
- Planos e pagamentos: `subscription_plan`, `organization_subscription`, `organization_ai_usage`, `payment`.
- ATS: `job`, `job_skill`, `candidate`, `candidate_skill`, `candidate_experience`, `application`, `application_stage_history`, `interview_note`.
- Auditoria: `audit_log`.
- IA/embeddings: `embedding_document`, `embedding_chunk`.

Pontos importantes:

- `organization` e `member` devem ser a base de escopo de tenant.
- `organization_subscription` aponta para `subscription_plan`, que contem limites atuais.
- `organization_ai_usage` ja permite controlar tokens de prompt, completion, embedding, cache e quantidade de requests.
- `application` ja possui `ai_score` e `ai_summary`, que devem ser preenchidos por resultado assincrono.
- `embedding_document` e `embedding_chunk` permitem versionar embeddings por entidade, modelo, fonte e hash de conteudo.

## 3. Lacunas que devemos adicionar

Antes de construir todos os endpoints, devemos adicionar suporte para eventos e controle operacional:

1. `outbox_event`
   - Guarda eventos produzidos pela API na mesma transacao da regra de negocio.
   - Permite publicar depois no RabbitMQ sem perder evento.

2. `inbox_event` ou tabela de idempotencia
   - Guarda eventos externos ja processados.
   - Evita processar duas vezes resultados vindos do worker Python.

3. `ai_processing_job`
   - Opcional, mas recomendado.
   - Representa jobs de IA com status, tentativas, erro, datas e entidade relacionada.
   - Facilita dashboard, retry manual e suporte.

## 4. Modulos da API

Implementar nesta ordem:

1. `organizations`
   - Criar organizacao.
   - Atualizar perfil.
   - Consultar organizacao ativa.
   - Aplicar escopo por `organizationId`.

2. `members`
   - Listar membros.
   - Alterar role.
   - Remover membro.
   - Validar limite `maxUsers`.

3. `invitations`
   - Criar convite.
   - Reenviar convite.
   - Cancelar convite.
   - Aceitar convite.
   - Emitir eventos de convite.

4. `subscription-plans`
   - Listar planos ativos.
   - Consultar limites do plano.
   - Seed inicial de planos.

5. `organization-subscriptions`
   - Consultar assinatura atual.
   - Aplicar trial.
   - Preparar troca de plano.
   - Bloquear recursos quando assinatura estiver inativa.

6. `jobs`
   - Criar vaga como draft.
   - Atualizar vaga.
   - Publicar vaga.
   - Pausar, fechar e arquivar.
   - Gerenciar skills da vaga.
   - Validar limite `maxJobs`.
   - Emitir `job.created`, `job.updated`, `job.published`.

7. `candidates`
   - Criar candidato.
   - Atualizar candidato.
   - Gerenciar skills.
   - Gerenciar experiencias.
   - Atualizar texto/url de curriculo.
   - Validar limite `maxCandidatesPerMonth`.
   - Emitir `candidate.created`, `candidate.updated`, `candidate.resume.updated`.

8. `applications`
   - Criar candidatura.
   - Impedir duplicidade por vaga/candidato.
   - Listar candidaturas por vaga.
   - Listar candidaturas por candidato.
   - Atualizar observacoes.
   - Emitir `application.created`.

9. `pipeline`
   - Mover candidatura de etapa.
   - Registrar `application_stage_history`.
   - Emitir `application.stage.changed`.

10. `interview-notes`
    - Criar nota.
    - Editar nota.
    - Listar notas por candidatura.
    - Emitir evento se a nota entrar no contexto de IA.

11. `audit`
    - Registrar acoes sensiveis.
    - Consultar auditoria por organizacao, entidade e usuario.

12. `outbox`
    - Criar publisher interno.
    - Publicar eventos pendentes no RabbitMQ.
    - Marcar evento como publicado.
    - Registrar falhas e tentativas.

13. `ai-results`
    - Receber/processar resultados do worker via consumer ou endpoint interno.
    - Atualizar `embedding_document`, `embedding_chunk`, `application.aiScore`, `application.aiSummary`.
    - Registrar uso em `organization_ai_usage`.

## 5. Contratos HTTP

Todos os endpoints devem seguir o padrao atual da API:

- Prefixo: `/api/v1`.
- Swagger com `operationId` estavel para Orval.
- DTOs separados para request, response e filtros.
- Respostas padronizadas pelo interceptor global.
- Erros padronizados pelo exception filter global.
- Paginacao padrao em listagens.
- Filtros previsiveis por query params.
- Ordenacao controlada por whitelist.

Padrao recomendado para rotas tenant-aware:

```txt
/api/v1/organizations/current
/api/v1/organizations/current/profile
/api/v1/organizations/current/members
/api/v1/organizations/current/invitations
/api/v1/organizations/current/jobs
/api/v1/organizations/current/candidates
/api/v1/organizations/current/applications
```

Rotas por recurso especifico:

```txt
/api/v1/jobs/:jobId
/api/v1/jobs/:jobId/skills
/api/v1/jobs/:jobId/applications
/api/v1/candidates/:candidateId
/api/v1/candidates/:candidateId/skills
/api/v1/candidates/:candidateId/experiences
/api/v1/applications/:applicationId/stage
/api/v1/applications/:applicationId/interview-notes
```

## 6. Permissoes

Usar roles de `organization_role`:

- `owner`: controle total da organizacao, plano e membros.
- `recruiter`: gerencia vagas, candidatos e candidaturas.

Implementar guards:

1. `AuthenticatedGuard`
2. `OrganizationContextGuard`
3. `OrganizationRoleGuard`
4. `PlanLimitGuard`

Todo acesso a dados de negocio deve passar por `organizationId`.

## 7. Limites por plano

Limites atuais em `subscription_plan`:

- `maxUsers`
- `maxJobs`
- `monthlyAiTokens`
- `maxCandidatesPerMonth`
- `customCareerPage`
- `apiAccess`
- `prioritySupport`

Regras:

1. Validar `maxUsers` antes de aceitar convite ou adicionar membro.
2. Validar `maxJobs` antes de publicar/criar nova vaga ativa, conforme regra definida.
3. Validar `maxCandidatesPerMonth` antes de criar/importar candidato.
4. Validar `monthlyAiTokens` antes de enfileirar job de IA.
5. Registrar consumo em `organization_ai_usage`.
6. Sempre retornar erro de limite com codigo estavel, por exemplo `PLAN_LIMIT_EXCEEDED`.

Para crescimento futuro:
- Manter limites fixos agora.
- Quando surgirem muitos limites, criar tabela flexivel `subscription_plan_limit`.
- Nao espalhar verificacoes de plano dentro dos services; centralizar em um `PlanLimitsService`.

## 8. Eventos

Eventos devem ser versionados e idempotentes.

Envelope padrao:

```json
{
  "eventId": "uuid-v7",
  "eventType": "candidate.updated",
  "version": 1,
  "occurredAt": "2026-06-20T00:00:00.000Z",
  "organizationId": "uuid",
  "actorUserId": "uuid",
  "correlationId": "uuid",
  "entity": {
    "type": "candidate",
    "id": "uuid"
  },
  "payload": {},
  "metadata": {}
}
```

Eventos de dominio iniciais:

- `organization.created`
- `member.invited`
- `member.role.changed`
- `job.created`
- `job.updated`
- `job.published`
- `job.closed`
- `candidate.created`
- `candidate.updated`
- `candidate.resume.updated`
- `application.created`
- `application.stage.changed`
- `interview_note.created`

Eventos de IA:

- `ai.embedding.requested`
- `ai.embedding.completed`
- `ai.embedding.failed`
- `ai.match.requested`
- `ai.match.completed`
- `ai.match.failed`
- `ai.resume_parse.requested`
- `ai.resume_parse.completed`
- `ai.resume_parse.failed`

## 9. RabbitMQ

Comecar simples:

Exchanges:

```txt
recruta.domain
recruta.ai
recruta.dlx
```

Queues:

```txt
ai.embedding.requests
ai.match.requests
ai.resume_parse.requests
ai.results
ai.dead_letter
```

Routing keys:

```txt
candidate.created
candidate.updated
candidate.resume.updated
job.published
application.created
ai.embedding.requested
ai.match.requested
ai.resume_parse.requested
ai.embedding.completed
ai.match.completed
ai.resume_parse.completed
```

Regras:

1. Nest publica via outbox.
2. Python consome filas de request.
3. Python publica resultados.
4. Nest consome resultados e atualiza o banco.
5. Mensagens com falha devem ir para DLQ apos tentativas.
6. Cada mensagem deve ter `eventId` para idempotencia.

## 10. IA e embeddings

Fluxo para candidato:

1. Candidato e criado ou atualizado.
2. API salva `candidate`.
3. API registra evento `candidate.updated`.
4. Outbox publica `ai.embedding.requested`.
5. Worker Python monta documento semantico do candidato.
6. Worker calcula hash do conteudo.
7. Se hash ja existe, reutiliza embedding.
8. Se nao existe, gera embedding e chunks.
9. Worker salva `embedding_document` e `embedding_chunk`.
10. Worker publica `ai.embedding.completed`.

Fluxo para vaga:

1. Vaga e publicada.
2. API registra `job.published`.
3. Worker gera embedding da vaga.
4. Worker atualiza embeddings.

Fluxo para match:

1. Candidatura e criada.
2. API registra `application.created`.
3. Worker compara embeddings de candidato e vaga.
4. Worker calcula score.
5. Worker publica `ai.match.completed`.
6. API atualiza `application.aiScore` e `application.aiSummary`.

## 11. Auditoria

Registrar no `audit_log`:

- criacao/alteracao de organizacao;
- alteracao de roles;
- convite/cancelamento de convite;
- publicacao/fechamento de vaga;
- criacao/alteracao de candidato;
- criacao de candidatura;
- mudanca de etapa;
- alteracoes de assinatura/plano;
- acoes administrativas sensiveis.

Auditoria deve ser escrita junto da transacao principal quando possivel.

## 12. Ordem de implementacao

### Fase 1: fundacao de dominio

1. Criar padrao de modulo: controller, service, repository, DTOs, decorators Swagger.
2. Criar contexto de organizacao.
3. Criar guards de auth, organizacao e role.
4. Criar services de plano e limites.
5. Criar auditoria.

### Fase 2: nucleo ATS

1. Organizations/profile.
2. Members/invitations.
3. Subscription plans/current subscription.
4. Jobs e job skills.
5. Candidates, skills e experiences.
6. Applications.
7. Pipeline/stage history.
8. Interview notes.

### Fase 3: eventos

1. Criar `outbox_event`.
2. Criar `OutboxService`.
3. Registrar eventos nos fluxos principais.
4. Criar publisher RabbitMQ.
5. Criar DLQ/retry.
6. Criar consumer de resultados de IA.

### Fase 4: IA Python

1. Criar worker Python.
2. Consumir requests de embedding.
3. Consumir requests de match.
4. Salvar embeddings no Postgres.
5. Publicar resultados.
6. Controlar tokens e cache.

### Fase 5: hardening

1. Testes e2e dos fluxos principais.
2. Testes de limites por plano.
3. Testes de idempotencia de eventos.
4. Seeds de planos.
5. Observabilidade de jobs.
6. Documentacao de ambiente e deploy.

## 13. Definicao de pronto

A API estara pronta para evoluir com IA quando:

- Todos os recursos principais estiverem escopados por organizacao.
- Toda rota estiver documentada no Swagger.
- Orval conseguir gerar client sem operationId instavel.
- Limites por plano forem aplicados nos fluxos principais.
- Auditoria existir para acoes sensiveis.
- Outbox registrar eventos de dominio.
- RabbitMQ publicar jobs de IA.
- Resultados de IA forem idempotentes.
- Worker Python puder ser ligado sem mudar regra de negocio da API.


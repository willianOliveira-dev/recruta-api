ALTER TABLE "subscription_plan" ALTER COLUMN "slug" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."plan";--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('basic', 'plus', 'pro');--> statement-breakpoint
ALTER TABLE "subscription_plan" ALTER COLUMN "slug" SET DATA TYPE "public"."plan" USING "slug"::"public"."plan";--> statement-breakpoint
DROP INDEX "candidate_email_uidx";--> statement-breakpoint
DROP INDEX "candidate_document_cpf_uidx";--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD COLUMN "pending_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD COLUMN "canceled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD COLUMN "gateway_plan_id" text;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD COLUMN "checkout_url" text;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD COLUMN "external_reference" text;--> statement-breakpoint
ALTER TABLE "candidate" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "gateway_subscription_id" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "gateway_plan_id" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "gateway_notification_id" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "external_reference" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "raw_status" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "raw_status_detail" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "subscription_plan" ADD COLUMN "currency" text DEFAULT 'BRL' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plan" ADD COLUMN "billing_period_months" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plan" ADD COLUMN "trial_days" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plan" ADD COLUMN "gateway_plan_id" text;--> statement-breakpoint
ALTER TABLE "subscription_plan" ADD COLUMN "checkout_url" text;--> statement-breakpoint
ALTER TABLE "subscription_plan" ADD COLUMN "pricing_justification" text;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD CONSTRAINT "organization_subscription_pending_plan_id_subscription_plan_id_fk" FOREIGN KEY ("pending_plan_id") REFERENCES "public"."subscription_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate" ADD CONSTRAINT "candidate_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_organization_id_idx" ON "application" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_subscription_external_reference_uidx" ON "organization_subscription" USING btree ("external_reference");--> statement-breakpoint
CREATE INDEX "candidate_organization_id_idx" ON "candidate" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_org_email_uidx" ON "candidate" USING btree ("organization_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_org_document_cpf_uidx" ON "candidate" USING btree ("organization_id","document_cpf");--> statement-breakpoint
CREATE INDEX "payment_gateway_subscription_idx" ON "payment" USING btree ("gateway_subscription_id");--> statement-breakpoint
CREATE INDEX "payment_external_reference_idx" ON "payment" USING btree ("external_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_gateway_notification_uidx" ON "payment" USING btree ("gateway","gateway_notification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plan_gateway_plan_uidx" ON "subscription_plan" USING btree ("gateway_plan_id");--> statement-breakpoint
INSERT INTO "subscription_plan" (
  "id",
  "name",
  "slug",
  "description",
  "price_in_cents",
  "currency",
  "billing_period_months",
  "trial_days",
  "max_users",
  "max_jobs",
  "monthly_ai_tokens",
  "max_candidates_per_month",
  "custom_career_page",
  "api_access",
  "priority_support",
  "pricing_justification",
  "is_active"
) VALUES
(
  '01972194-7d9f-7000-9c9e-b2abdc1d8b01',
  'Básico',
  'basic',
  'Plano de entrada para equipes pequenas validarem o ATS com limites controlados de usuários, vagas e IA.',
  14900,
  'BRL',
  1,
  14,
  2,
  3,
  200000,
  100,
  false,
  false,
  false,
  'R$149/mês cobre o uso inicial de uma equipe pequena, limita custo de IA e mantém margem para suporte padrão sem bloquear a validação do produto.',
  true
),
(
  '01972194-7d9f-7000-9c9e-b2abdc1d8b02',
  'Plus',
  'plus',
  'Plano recomendado para operação recorrente com mais vagas, volume mensal de candidatos e página de carreira customizada.',
  39900,
  'BRL',
  1,
  14,
  8,
  15,
  1200000,
  800,
  true,
  false,
  false,
  'R$399/mês posiciona o plano principal para times em crescimento, ampliando assentos e volume de triagem sem liberar API ou suporte prioritário.',
  true
),
(
  '01972194-7d9f-7000-9c9e-b2abdc1d8b03',
  'Pro',
  'pro',
  'Plano avançado para recrutamento em escala com maior consumo de IA, API, página de carreira e suporte prioritário.',
  89900,
  'BRL',
  1,
  14,
  25,
  60,
  5000000,
  3000,
  true,
  true,
  true,
  'R$899/mês reflete operação com integração, maior custo de IA e suporte prioritário para organizações com múltiplas vagas e alto volume de candidatos.',
  true
)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = excluded."name",
  "description" = excluded."description",
  "price_in_cents" = excluded."price_in_cents",
  "currency" = excluded."currency",
  "billing_period_months" = excluded."billing_period_months",
  "trial_days" = excluded."trial_days",
  "max_users" = excluded."max_users",
  "max_jobs" = excluded."max_jobs",
  "monthly_ai_tokens" = excluded."monthly_ai_tokens",
  "max_candidates_per_month" = excluded."max_candidates_per_month",
  "custom_career_page" = excluded."custom_career_page",
  "api_access" = excluded."api_access",
  "priority_support" = excluded."priority_support",
  "pricing_justification" = excluded."pricing_justification",
  "is_active" = excluded."is_active",
  "updated_at" = now();

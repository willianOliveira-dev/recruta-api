# Recruta API Agent Guidelines

## Mandatory Project Skills

For every implementation, refactor, review, architecture decision, test, or debugging task in this repository, use these project skills before making changes:

- `.agents/skills/nestjs-best-practices`
- `.agents/skills/typescript-expert`
- `.agents/skills/solid`
- `.agents/skills/code-review-expert`
- `.agents/skills/resume-ats-optimizer`
- `.agents/skills/job-description-analyzer`
- `.agents/skills/academic-cv-builder`
- `.agents/skills/application-form-filler`
- `.agents/skills/career-changer-translator`
- `.agents/skills/cold-email-writer`
- `.agents/skills/cover-letter-generator`
- `.agents/skills/creative-portfolio-resume`
- `.agents/skills/executive-resume-writer`
- `.agents/skills/interview-prep-generator`
- `.agents/skills/linkedin-profile-optimizer`
- `.agents/skills/offer-comparison-analyzer`
- `.agents/skills/portfolio-case-study-writer`
- `.agents/skills/reference-list-builder`
- `.agents/skills/resume-bullet-writer`
- `.agents/skills/resume-formatter`
- `.agents/skills/resume-quantifier`
- `.agents/skills/resume-section-builder`
- `.agents/skills/resume-tailor`
- `.agents/skills/resume-version-manager`
- `.agents/skills/salary-negotiation-prep`
- `.agents/skills/tech-resume-optimizer`

The NestJS, TypeScript, SOLID, and code-review skills define the engineering baseline. The ATS and career-document skills define the product intelligence baseline: model candidate, resume, job, match, keyword, parsing, screening, application behavior, and hiring workflow signals as first-class ATS domain concepts, not generic CRUD.

These ATS/career skills are not product instructions to help candidates bypass screening. Use them as adversarial and domain context for building a stronger ATS: understand how candidates tailor resumes, cover letters, LinkedIn profiles, portfolios, forms, references, interview preparation, and compensation narratives so the API can evaluate evidence, consistency, fit, qualification signals, keyword stuffing, role alignment, and possible gaming attempts more intelligently.

## Architecture Baseline

- Think before acting: identify the smallest correct implementation path, expected side effects, migration impact, tests needed, and rollback risk before changing code.
- Build modules as vertical feature slices under `src/modules`.
- Keep each module organized by responsibility. The module root should keep the `*.module.ts`; place HTTP entry points in `controllers/`, business orchestration in `services/`, persistence in `repositories/`, request/response contracts in `dto/`, domain objects and pure rules in `domain/`, tests in `specs/`, and shared module-local types in `types/` when needed.
- Do not leave mixed files directly in a module root unless the file is the module definition or a deliberate module-level entry point.
- Keep controllers thin; put orchestration in services and persistence in repositories.
- Use DTOs for HTTP requests/responses and keep Swagger operation IDs stable.
- Preserve the global API contract: `/api/v1`, standardized success/error envelopes, validation pipe, exception filter, and Scalar/OpenAPI.
- Apply tenant scope through `organizationId` on all business data.
- Avoid circular dependencies and broad shared services.
- Prefer simple, explicit abstractions over speculative architecture.
- Keep the system intact: every change must preserve build, type safety, database consistency, API contracts, tenant isolation, and existing behavior unless an intentional migration path is documented.
- Do not leave modeled work blank: anything introduced in the database schema must be used, configured, and implemented in the application flow, or explicitly documented as a staged follow-up with the reason it is not yet wired.
- Use the code-review skill as a quality gate for implementation direction, scalability, SOLID adherence, security, data integrity, and operational reliability before considering a task complete.

## ATS Domain Baseline

- Treat organizations as tenants and recruiters as actors inside an organization.
- Treat jobs, candidates, resumes, applications, pipeline stages, interview notes, embeddings, and AI match results as core ATS domain concepts.
- Treat resume tailoring, keyword optimization, career-change translation, portfolio evidence, application-form consistency, interview signals, references, and compensation expectations as useful ATS signals when designing future data models and scoring workflows.
- Design screening and matching around evidence quality, recency, relevance, consistency, seniority alignment, and job-specific requirements, not only keyword presence.
- Expect candidates to adapt content for ATS systems; build parsing and scoring flows that reward substantiated fit and reduce the impact of keyword stuffing or misleading formatting.
- Preserve event and idempotency readiness for async IA flows.
- Design APIs so future ranking, parsing, keyword matching, screening, and match scoring can evolve without rewriting the module boundary.

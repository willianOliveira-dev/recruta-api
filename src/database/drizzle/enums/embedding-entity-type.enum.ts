import { pgEnum } from 'drizzle-orm/pg-core';

export const embeddingEntityTypeEnum = pgEnum('embedding_entity_type', [
  'organization',
  'organization_profile',
  'job',
  'job_skill',
  'candidate',
  'candidate_skill',
  'candidate_experience',
  'application',
  'application_stage_history',
  'interview_note',
  'subscription_plan',
  'organization_subscription',
  'organization_ai_usage',
  'member',
  'invitation',
  'payment',
  'audit_log',
]);

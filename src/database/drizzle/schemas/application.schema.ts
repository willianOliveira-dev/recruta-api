import {
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { applicationStageEnum } from '../enums/application-stage.enum';
import {
  createdAt,
  timestampUtc,
  updatedAt,
  uuidv7PrimaryKey,
} from '../schema-helpers';
import { organization } from './auth.schema';
import { candidate } from './candidate.schema';
import { job } from './job.schema';

export const application = pgTable(
  'application',
  {
    id: uuidv7PrimaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => job.id, { onDelete: 'cascade' }),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidate.id, { onDelete: 'cascade' }),
    stage: applicationStageEnum('stage').default('applied').notNull(),
    stageEnteredAt: timestampUtc('stage_entered_at').defaultNow().notNull(),
    aiScore: numeric('ai_score', { precision: 5, scale: 2 }),
    aiSummary: text('ai_summary'),
    notes: text('notes'),
    statusToken: text('status_token').unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('application_organization_id_idx').on(table.organizationId),
    index('application_job_id_idx').on(table.jobId),
    index('application_candidate_id_idx').on(table.candidateId),
    index('application_stage_idx').on(table.jobId, table.stage),
    uniqueIndex('application_job_candidate_uidx').on(
      table.jobId,
      table.candidateId,
    ),
  ],
);

import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { aiProcessingJobStatusEnum } from '../enums/ai-processing-job-status.enum';
import {
  createdAt,
  timestampUtc,
  updatedAt,
  uuidv7PrimaryKey,
} from '../schema-helpers';
import { organization } from './auth.schema';
import { outboxEvent } from './outbox-event.schema';

type JobPayload = Record<string, unknown>;

export const aiProcessingJob = pgTable(
  'ai_processing_job',
  {
    id: uuidv7PrimaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    jobType: text('job_type').notNull(),
    status: aiProcessingJobStatusEnum('status').default('pending').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    inputHash: text('input_hash'),
    idempotencyKey: text('idempotency_key').notNull(),
    outboxEventId: uuid('outbox_event_id').references(() => outboxEvent.id, {
      onDelete: 'set null',
    }),
    requestPayload: jsonb('request_payload')
      .$type<JobPayload>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    resultPayload: jsonb('result_payload')
      .$type<JobPayload>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(3).notNull(),
    queuedAt: timestampUtc('queued_at'),
    startedAt: timestampUtc('started_at'),
    finishedAt: timestampUtc('finished_at'),
    nextAttemptAt: timestampUtc('next_attempt_at'),
    lockedAt: timestampUtc('locked_at'),
    lockedBy: text('locked_by'),
    lastError: text('last_error'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('ai_processing_job_idempotency_key_uidx').on(
      table.idempotencyKey,
    ),
    index('ai_processing_job_organization_id_idx').on(table.organizationId),
    index('ai_processing_job_status_next_attempt_idx').on(
      table.status,
      table.nextAttemptAt,
    ),
    index('ai_processing_job_status_locked_idx').on(
      table.status,
      table.lockedAt,
    ),
    index('ai_processing_job_type_idx').on(table.jobType),
    index('ai_processing_job_type_input_hash_idx').on(
      table.jobType,
      table.inputHash,
    ),
    index('ai_processing_job_entity_idx').on(table.entityType, table.entityId),
    index('ai_processing_job_outbox_event_id_idx').on(table.outboxEventId),
  ],
);

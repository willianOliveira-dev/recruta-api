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
import { inboxEventStatusEnum } from '../enums/inbox-event-status.enum';
import {
  createdAt,
  timestampUtc,
  updatedAt,
  uuidv7PrimaryKey,
} from '../schema-helpers';
import { organization } from './auth.schema';

type EventPayload = Record<string, unknown>;

export const inboxEvent = pgTable(
  'inbox_event',
  {
    id: uuidv7PrimaryKey(),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    source: text('source').notNull(),
    organizationId: uuid('organization_id').references(() => organization.id, {
      onDelete: 'set null',
    }),
    correlationId: uuid('correlation_id'),
    payloadHash: text('payload_hash'),
    payload: jsonb('payload')
      .$type<EventPayload>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    metadata: jsonb('metadata')
      .$type<EventPayload>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    status: inboxEventStatusEnum('status').default('processing').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    nextAttemptAt: timestampUtc('next_attempt_at'),
    lockedAt: timestampUtc('locked_at'),
    lockedBy: text('locked_by'),
    processedAt: timestampUtc('processed_at'),
    lastError: text('last_error'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('inbox_event_source_event_id_uidx').on(
      table.source,
      table.eventId,
    ),
    index('inbox_event_source_idx').on(table.source),
    index('inbox_event_status_next_attempt_idx').on(
      table.status,
      table.nextAttemptAt,
    ),
    index('inbox_event_status_locked_idx').on(table.status, table.lockedAt),
    index('inbox_event_organization_id_idx').on(table.organizationId),
    index('inbox_event_correlation_id_idx').on(table.correlationId),
  ],
);

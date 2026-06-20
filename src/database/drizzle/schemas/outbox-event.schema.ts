import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { outboxEventStatusEnum } from '../enums/outbox-event-status.enum';
import {
  createdAt,
  timestampUtc,
  updatedAt,
  uuidv7PrimaryKey,
} from '../schema-helpers';
import { organization, user } from './auth.schema';

type EventPayload = Record<string, unknown>;

export const outboxEvent = pgTable(
  'outbox_event',
  {
    id: uuidv7PrimaryKey(),
    eventType: text('event_type').notNull(),
    version: integer('version').default(1).notNull(),
    occurredAt: timestampUtc('occurred_at').defaultNow().notNull(),
    organizationId: uuid('organization_id').references(() => organization.id, {
      onDelete: 'set null',
    }),
    actorUserId: uuid('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    correlationId: uuid('correlation_id'),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    payload: jsonb('payload')
      .$type<EventPayload>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    metadata: jsonb('metadata')
      .$type<EventPayload>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    status: outboxEventStatusEnum('status').default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    nextAttemptAt: timestampUtc('next_attempt_at'),
    lockedAt: timestampUtc('locked_at'),
    lockedBy: text('locked_by'),
    publishedAt: timestampUtc('published_at'),
    lastError: text('last_error'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('outbox_event_status_next_attempt_idx').on(
      table.status,
      table.nextAttemptAt,
    ),
    index('outbox_event_status_locked_idx').on(table.status, table.lockedAt),
    index('outbox_event_organization_id_idx').on(table.organizationId),
    index('outbox_event_event_type_idx').on(table.eventType),
    index('outbox_event_entity_idx').on(table.entityType, table.entityId),
    index('outbox_event_correlation_id_idx').on(table.correlationId),
  ],
);

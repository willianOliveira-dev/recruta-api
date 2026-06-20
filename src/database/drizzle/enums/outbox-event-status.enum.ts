import { pgEnum } from 'drizzle-orm/pg-core';

export const outboxEventStatusEnum = pgEnum('outbox_event_status', [
  'pending',
  'processing',
  'published',
  'failed',
]);

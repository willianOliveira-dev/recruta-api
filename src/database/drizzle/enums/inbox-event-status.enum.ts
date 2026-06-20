import { pgEnum } from 'drizzle-orm/pg-core';

export const inboxEventStatusEnum = pgEnum('inbox_event_status', [
  'processing',
  'processed',
  'failed',
]);

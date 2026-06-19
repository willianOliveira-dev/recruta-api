import { pgEnum } from 'drizzle-orm/pg-core';

export const jobStatusEnum = pgEnum('job_status', [
  'draft',
  'published',
  'paused',
  'closed',
  'archived',
]);

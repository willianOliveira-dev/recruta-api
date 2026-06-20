import { pgEnum } from 'drizzle-orm/pg-core';

export const aiProcessingJobStatusEnum = pgEnum('ai_processing_job_status', [
  'pending',
  'queued',
  'processing',
  'completed',
  'failed',
  'canceled',
]);

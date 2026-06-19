import { pgEnum } from 'drizzle-orm/pg-core';

export const applicationStageEnum = pgEnum('application_stage', [
  'applied',
  'screening',
  'interview',
  'technical',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
]);

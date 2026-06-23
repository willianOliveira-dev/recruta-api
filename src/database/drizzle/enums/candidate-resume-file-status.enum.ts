import { pgEnum } from 'drizzle-orm/pg-core';

export const candidateResumeFileStatusEnum = pgEnum(
  'candidate_resume_file_status',
  ['pending', 'uploaded', 'rejected', 'deleted'],
);

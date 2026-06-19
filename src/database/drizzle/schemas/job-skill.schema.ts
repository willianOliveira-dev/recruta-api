import {
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { uuidv7PrimaryKey } from '../schema-helpers';
import { job } from './job.schema';

export const jobSkill = pgTable(
  'job_skill',
  {
    id: uuidv7PrimaryKey(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => job.id, { onDelete: 'cascade' }),
    skill: text('skill').notNull(),
    required: boolean('required').default(true).notNull(),
  },
  (table) => [
    index('job_skill_job_id_idx').on(table.jobId),
    uniqueIndex('job_skill_job_skill_uidx').on(table.jobId, table.skill),
  ],
);

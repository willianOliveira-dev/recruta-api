import { boolean, date, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt, uuidv7PrimaryKey } from '../schema-helpers';
import { candidate } from './candidate.schema';

export const candidateExperience = pgTable(
  'candidate_experience',
  {
    id: uuidv7PrimaryKey(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidate.id, { onDelete: 'cascade' }),
    company: text('company').notNull(),
    role: text('role').notNull(),
    description: text('description'),
    startedAt: date('started_at', { mode: 'date' }),
    endedAt: date('ended_at', { mode: 'date' }),
    isCurrent: boolean('is_current').default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('candidate_experience_candidate_id_idx').on(table.candidateId),
  ],
);

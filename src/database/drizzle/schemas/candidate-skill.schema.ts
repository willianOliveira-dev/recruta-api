import {
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { uuidv7PrimaryKey } from '../schema-helpers';
import { candidate } from './candidate.schema';

export const candidateSkill = pgTable(
  'candidate_skill',
  {
    id: uuidv7PrimaryKey(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidate.id, { onDelete: 'cascade' }),
    skill: text('skill').notNull(),
    years: integer('years'),
  },
  (table) => [
    index('candidate_skill_candidate_id_idx').on(table.candidateId),
    uniqueIndex('candidate_skill_candidate_skill_uidx').on(
      table.candidateId,
      table.skill,
    ),
  ],
);

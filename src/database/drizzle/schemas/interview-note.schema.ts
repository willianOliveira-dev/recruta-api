import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, updatedAt, uuidv7PrimaryKey } from '../schema-helpers';
import { application } from './application.schema';
import { user } from './auth.schema';

export const interviewNote = pgTable(
  'interview_note',
  {
    id: uuidv7PrimaryKey(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => application.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    content: text('content').notNull(),
    rating: integer('rating'),
    includeInAiContext: boolean('include_in_ai_context')
      .default(false)
      .notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('interview_note_application_id_idx').on(table.applicationId),
    index('interview_note_author_id_idx').on(table.authorId),
  ],
);

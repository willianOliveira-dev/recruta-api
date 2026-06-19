import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { applicationStageEnum } from '../enums/application-stage.enum';
import { createdAt, uuidv7PrimaryKey } from '../schema-helpers';
import { application } from './application.schema';
import { user } from './auth.schema';

export const applicationStageHistory = pgTable(
  'application_stage_history',
  {
    id: uuidv7PrimaryKey(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => application.id, { onDelete: 'cascade' }),
    fromStage: applicationStageEnum('from_stage'),
    toStage: applicationStageEnum('to_stage').notNull(),
    movedBy: uuid('moved_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    reason: text('reason'),
    createdAt: createdAt(),
  },
  (table) => [
    index('application_stage_history_application_id_idx').on(
      table.applicationId,
    ),
    index('application_stage_history_moved_by_idx').on(table.movedBy),
  ],
);

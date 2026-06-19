import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { contractTypeEnum } from '../enums/contract-type.enum';
import { jobStatusEnum } from '../enums/job-status.enum';
import { seniorityLevelEnum } from '../enums/seniority-level.enum';
import { workModeEnum } from '../enums/work-mode.enum';
import {
  createdAt,
  timestampUtc,
  updatedAt,
  uuidv7PrimaryKey,
} from '../schema-helpers';
import { organization, user } from './auth.schema';

export const job = pgTable(
  'job',
  {
    id: uuidv7PrimaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    recruiterId: uuid('recruiter_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    area: text('area').notNull(),
    department: text('department'),
    seniority: seniorityLevelEnum('seniority').notNull(),
    workMode: workModeEnum('work_mode').notNull(),
    locationCity: text('location_city'),
    locationState: text('location_state'),
    locationCountry: text('location_country'),
    contractType: contractTypeEnum('contract_type').notNull(),
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    salaryCurrency: text('salary_currency').default('BRL').notNull(),
    summary: text('summary'),
    responsibilities: text('responsibilities'),
    requirements: text('requirements'),
    niceToHave: text('nice_to_have'),
    benefits: text('benefits'),
    vacanciesCount: integer('vacancies_count').default(1).notNull(),
    appliesUntil: timestampUtc('applies_until'),
    maxApplicants: integer('max_applicants'),
    status: jobStatusEnum('status').default('draft').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('job_organization_id_idx').on(table.organizationId),
    index('job_recruiter_id_idx').on(table.recruiterId),
    index('job_status_idx').on(table.status),
    index('job_org_status_idx').on(table.organizationId, table.status),
  ],
);

import {
  date,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { availabilityTypeEnum } from '../enums/availability-type.enum';
import { seniorityLevelEnum } from '../enums/seniority-level.enum';
import { workModePreferenceEnum } from '../enums/work-mode-preference.enum';
import { createdAt, updatedAt, uuidv7PrimaryKey } from '../schema-helpers';
import { organization } from './auth.schema';

export const candidate = pgTable(
  'candidate',
  {
    id: uuidv7PrimaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    documentCpf: text('document_cpf'),
    birthDate: date('birth_date', { mode: 'date' }),
    city: text('city'),
    state: text('state'),
    country: text('country'),
    linkedinUrl: text('linkedin_url'),
    githubUrl: text('github_url'),
    portfolioUrl: text('portfolio_url'),
    resumeUrl: text('resume_url'),
    resumeText: text('resume_text'),
    workModePreference: workModePreferenceEnum('work_mode_preference'),
    availability: availabilityTypeEnum('availability'),
    salaryExpectation: integer('salary_expectation'),
    salaryCurrency: text('salary_currency').default('BRL'),
    seniority: seniorityLevelEnum('seniority'),
    yearsOfExperience: integer('years_of_experience'),
    educationDegree: text('education_degree'),
    educationInstitution: text('education_institution'),
    educationYear: integer('education_year'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('candidate_organization_id_idx').on(table.organizationId),
    uniqueIndex('candidate_org_email_uidx').on(
      table.organizationId,
      table.email,
    ),
    uniqueIndex('candidate_org_document_cpf_uidx').on(
      table.organizationId,
      table.documentCpf,
    ),
    index('candidate_name_idx').on(table.fullName),
  ],
);

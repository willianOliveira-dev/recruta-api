import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { candidateResumeFileStatusEnum } from '../enums/candidate-resume-file-status.enum';
import {
  createdAt,
  timestampUtc,
  updatedAt,
  uuidv7PrimaryKey,
} from '../schema-helpers';
import { organization, user } from './auth.schema';
import { candidate } from './candidate.schema';

export const candidateResumeFile = pgTable(
  'candidate_resume_file',
  {
    id: uuidv7PrimaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidate.id, { onDelete: 'cascade' }),
    storageProvider: text('storage_provider')
      .default('cloudflare_r2')
      .notNull(),
    bucket: text('bucket').notNull(),
    objectKey: text('object_key').notNull(),
    originalFileName: text('original_file_name').notNull(),
    mimeType: text('mime_type').default('application/pdf').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    checksumSha256: text('checksum_sha256'),
    status: candidateResumeFileStatusEnum('status')
      .default('pending')
      .notNull(),
    isCurrent: boolean('is_current').default(false).notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    uploadedAt: timestampUtc('uploaded_at'),
    rejectedAt: timestampUtc('rejected_at'),
    rejectionReason: text('rejection_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('candidate_resume_file_organization_id_idx').on(table.organizationId),
    index('candidate_resume_file_candidate_id_idx').on(table.candidateId),
    index('candidate_resume_file_status_idx').on(table.status),
    index('candidate_resume_file_current_idx').on(
      table.candidateId,
      table.isCurrent,
    ),
    uniqueIndex('candidate_resume_file_object_key_uidx').on(table.objectKey),
  ],
);

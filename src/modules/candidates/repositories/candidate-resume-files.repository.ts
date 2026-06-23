import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { database } from '../../../config/database.config';
import { DRIZZLE } from '../../../database/drizzle/drizzle.module';
import {
  auditLog,
  candidate,
  candidateResumeFile,
  outboxEvent,
} from '../../../database/drizzle/schema';
import { CANDIDATE_RESUME_FILE_EVENT_TYPES } from '../domain/candidate-resume-file-events';

type Database = typeof database;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export type CandidateResumeFileRecord = typeof candidateResumeFile.$inferSelect;

export interface CreatePendingCandidateResumeFileInput {
  id: string;
  organizationId: string;
  candidateId: string;
  actorUserId: string;
  bucket: string;
  objectKey: string;
  originalFileName: string;
  sizeBytes: number;
  checksumSha256: string | null;
}

@Injectable()
export class CandidateResumeFilesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async candidateExists(organizationId: string, candidateId: string) {
    const [row] = await this.db
      .select({ id: candidate.id })
      .from(candidate)
      .where(
        and(
          eq(candidate.organizationId, organizationId),
          eq(candidate.id, candidateId),
        ),
      )
      .limit(1);

    return Boolean(row);
  }

  async findById(input: {
    organizationId: string;
    candidateId: string;
    resumeFileId: string;
  }): Promise<CandidateResumeFileRecord | null> {
    const [row] = await this.db
      .select()
      .from(candidateResumeFile)
      .where(
        and(
          eq(candidateResumeFile.organizationId, input.organizationId),
          eq(candidateResumeFile.candidateId, input.candidateId),
          eq(candidateResumeFile.id, input.resumeFileId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async findCurrentUploaded(input: {
    organizationId: string;
    candidateId: string;
  }): Promise<CandidateResumeFileRecord | null> {
    const [row] = await this.db
      .select()
      .from(candidateResumeFile)
      .where(
        and(
          eq(candidateResumeFile.organizationId, input.organizationId),
          eq(candidateResumeFile.candidateId, input.candidateId),
          eq(candidateResumeFile.status, 'uploaded'),
          eq(candidateResumeFile.isCurrent, true),
        ),
      )
      .orderBy(desc(candidateResumeFile.uploadedAt))
      .limit(1);

    return row ?? null;
  }

  async createPending(
    input: CreatePendingCandidateResumeFileInput,
  ): Promise<CandidateResumeFileRecord> {
    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(candidateResumeFile)
        .values({
          id: input.id,
          organizationId: input.organizationId,
          candidateId: input.candidateId,
          bucket: input.bucket,
          objectKey: input.objectKey,
          originalFileName: input.originalFileName,
          mimeType: 'application/pdf',
          sizeBytes: input.sizeBytes,
          checksumSha256: input.checksumSha256,
          status: 'pending',
          isCurrent: false,
          createdByUserId: input.actorUserId,
        })
        .returning();

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: CANDIDATE_RESUME_FILE_EVENT_TYPES.uploadRequested,
        entityId: created.id,
        payload: {
          candidateId: input.candidateId,
          sizeBytes: input.sizeBytes,
        },
      });

      return created;
    });
  }

  async markUploaded(input: {
    organizationId: string;
    candidateId: string;
    resumeFileId: string;
    actorUserId: string;
    objectKey: string;
  }): Promise<CandidateResumeFileRecord | null> {
    return this.db.transaction(async (tx) => {
      const file = await this.lockFile(tx, input);

      if (!file) {
        return null;
      }

      await tx
        .update(candidateResumeFile)
        .set({
          isCurrent: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(candidateResumeFile.organizationId, input.organizationId),
            eq(candidateResumeFile.candidateId, input.candidateId),
          ),
        );

      const [updated] = await tx
        .update(candidateResumeFile)
        .set({
          objectKey: input.objectKey,
          status: 'uploaded',
          isCurrent: true,
          uploadedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(candidateResumeFile.id, file.id))
        .returning();

      await tx
        .update(candidate)
        .set({
          resumeUrl: null,
          updatedAt: new Date(),
        })
        .where(eq(candidate.id, input.candidateId));

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: CANDIDATE_RESUME_FILE_EVENT_TYPES.uploaded,
        entityId: file.id,
        payload: {
          candidateId: input.candidateId,
          sizeBytes: file.sizeBytes,
        },
      });

      return updated;
    });
  }

  async markRejected(input: {
    organizationId: string;
    candidateId: string;
    resumeFileId: string;
    actorUserId: string;
    reason: string;
  }): Promise<CandidateResumeFileRecord | null> {
    return this.db.transaction(async (tx) => {
      const file = await this.lockFile(tx, input);

      if (!file) {
        return null;
      }

      const [updated] = await tx
        .update(candidateResumeFile)
        .set({
          status: 'rejected',
          isCurrent: false,
          rejectedAt: new Date(),
          rejectionReason: input.reason,
          updatedAt: new Date(),
        })
        .where(eq(candidateResumeFile.id, file.id))
        .returning();

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: CANDIDATE_RESUME_FILE_EVENT_TYPES.rejected,
        entityId: file.id,
        payload: {
          candidateId: input.candidateId,
          reason: input.reason,
        },
      });

      return updated;
    });
  }

  private async lockFile(
    tx: Transaction,
    input: {
      organizationId: string;
      candidateId: string;
      resumeFileId: string;
    },
  ) {
    const [row] = await tx
      .select()
      .from(candidateResumeFile)
      .where(
        and(
          eq(candidateResumeFile.organizationId, input.organizationId),
          eq(candidateResumeFile.candidateId, input.candidateId),
          eq(candidateResumeFile.id, input.resumeFileId),
        ),
      )
      .limit(1)
      .for('update');

    return row ?? null;
  }

  private async writeAuditAndOutbox(
    tx: Transaction,
    input: {
      organizationId: string;
      actorUserId: string;
      eventType: string;
      entityId: string;
      payload: Record<string, unknown>;
    },
  ) {
    await tx.insert(auditLog).values({
      organizationId: input.organizationId,
      userId: input.actorUserId,
      action: input.eventType,
      entityType: 'candidate_resume_file',
      entityId: input.entityId,
    });

    await tx.insert(outboxEvent).values({
      eventType: input.eventType,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entityType: 'candidate_resume_file',
      entityId: input.entityId,
      payload: input.payload,
    });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { database } from '../../../config/database.config';
import { DRIZZLE } from '../../../database/drizzle/drizzle.module';
import {
  application,
  auditLog,
  candidate,
  job,
  member,
  outboxEvent,
} from '../../../database/drizzle/schema';
import type { MemberRole } from '../../members/domain/member-role';
import { APPLICATION_EVENT_TYPES } from '../domain/application-events';
import type { ApplicationListQueryDto } from '../dto/application-query.dto';

type Database = typeof database;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type ApplicationRecord = typeof application.$inferSelect;

export interface ApplicationActorRecord {
  id: string;
  userId: string;
  role: MemberRole;
}

export interface ApplicationReferenceCheck {
  jobExists: boolean;
  candidateExists: boolean;
}

export interface ApplicationListInput extends ApplicationListQueryDto {
  organizationId: string;
  jobId?: string;
  candidateId?: string;
}

export interface ApplicationListResult {
  items: ApplicationRecord[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class ApplicationsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findActorMember(
    organizationId: string,
    userId: string,
  ): Promise<ApplicationActorRecord | null> {
    const [row] = await this.db
      .select({
        id: member.id,
        userId: member.userId,
        role: member.role,
      })
      .from(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.userId, userId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async findReferenceStatus(
    organizationId: string,
    jobId: string,
    candidateId: string,
  ): Promise<ApplicationReferenceCheck> {
    const [jobRecord, candidateRecord] = await Promise.all([
      this.db
        .select({ id: job.id })
        .from(job)
        .where(and(eq(job.organizationId, organizationId), eq(job.id, jobId)))
        .limit(1),
      this.db
        .select({ id: candidate.id })
        .from(candidate)
        .where(
          and(
            eq(candidate.organizationId, organizationId),
            eq(candidate.id, candidateId),
          ),
        )
        .limit(1),
    ]);

    return {
      jobExists: Boolean(jobRecord[0]),
      candidateExists: Boolean(candidateRecord[0]),
    };
  }

  async findById(
    organizationId: string,
    applicationId: string,
  ): Promise<ApplicationRecord | null> {
    const [row] = await this.db
      .select()
      .from(application)
      .where(
        and(
          eq(application.organizationId, organizationId),
          eq(application.id, applicationId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async list(input: ApplicationListInput): Promise<ApplicationListResult> {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const filters = [
      eq(application.organizationId, input.organizationId),
      input.jobId ? eq(application.jobId, input.jobId) : undefined,
      input.candidateId
        ? eq(application.candidateId, input.candidateId)
        : undefined,
      input.stage ? eq(application.stage, input.stage) : undefined,
    ].filter((item): item is Exclude<typeof item, undefined> =>
      Boolean(item),
    );
    const where = and(...filters);

    const [items, totalRows] = await Promise.all([
      this.db
        .select()
        .from(application)
        .where(where)
        .orderBy(desc(application.createdAt), asc(application.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(application)
        .where(where),
    ]);

    return {
      items,
      total: totalRows[0]?.count ?? 0,
      page,
      pageSize,
    };
  }

  async create(input: {
    organizationId: string;
    jobId: string;
    candidateId: string;
    actorUserId: string;
    notes: string | null;
  }): Promise<ApplicationRecord> {
    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(application)
        .values({
          organizationId: input.organizationId,
          jobId: input.jobId,
          candidateId: input.candidateId,
          notes: input.notes,
        })
        .returning();

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: APPLICATION_EVENT_TYPES.created,
        entityId: created.id,
        payload: {
          jobId: created.jobId,
          candidateId: created.candidateId,
          stage: created.stage,
        },
      });

      return created;
    });
  }

  async updateNotes(input: {
    organizationId: string;
    applicationId: string;
    actorUserId: string;
    notes: string | null;
  }): Promise<ApplicationRecord | null> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(application)
        .set({
          notes: input.notes,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(application.organizationId, input.organizationId),
            eq(application.id, input.applicationId),
          ),
        )
        .returning();

      if (!updated) {
        return null;
      }

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: APPLICATION_EVENT_TYPES.notesUpdated,
        entityId: updated.id,
        payload: {
          hasNotes: Boolean(updated.notes),
        },
      });

      return updated;
    });
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
      entityType: 'application',
      entityId: input.entityId,
    });

    await tx.insert(outboxEvent).values({
      eventType: input.eventType,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entityType: 'application',
      entityId: input.entityId,
      payload: input.payload,
    });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { database } from '../../../config/database.config';
import { DRIZZLE } from '../../../database/drizzle/drizzle.module';
import {
  application,
  auditLog,
  interviewNote,
  member,
  outboxEvent,
} from '../../../database/drizzle/schema';
import type { MemberRole } from '../../members/domain/member-role';
import { INTERVIEW_NOTE_EVENT_TYPES } from '../domain/interview-note-events';

type Database = typeof database;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type InterviewNoteRecord = typeof interviewNote.$inferSelect;

export interface InterviewNoteActorRecord {
  id: string;
  userId: string;
  role: MemberRole;
}

@Injectable()
export class InterviewNotesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findActorMember(
    organizationId: string,
    userId: string,
  ): Promise<InterviewNoteActorRecord | null> {
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

  async applicationExists(
    organizationId: string,
    applicationId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: application.id })
      .from(application)
      .where(
        and(
          eq(application.organizationId, organizationId),
          eq(application.id, applicationId),
        ),
      )
      .limit(1);

    return Boolean(row);
  }

  async create(input: {
    organizationId: string;
    applicationId: string;
    actorUserId: string;
    content: string;
    rating: number | null;
    includeInAiContext: boolean;
  }): Promise<InterviewNoteRecord | null> {
    return this.db.transaction(async (tx) => {
      const [applicationRecord] = await tx
        .select({ id: application.id })
        .from(application)
        .where(
          and(
            eq(application.organizationId, input.organizationId),
            eq(application.id, input.applicationId),
          ),
        )
        .limit(1);

      if (!applicationRecord) {
        return null;
      }

      const [created] = await tx
        .insert(interviewNote)
        .values({
          applicationId: input.applicationId,
          authorId: input.actorUserId,
          content: input.content,
          rating: input.rating,
          includeInAiContext: input.includeInAiContext,
        })
        .returning();

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: INTERVIEW_NOTE_EVENT_TYPES.created,
        entityId: created.id,
        payload: {
          applicationId: created.applicationId,
          hasRating: created.rating !== null,
          includeInAiContext: created.includeInAiContext,
        },
      });

      if (created.includeInAiContext) {
        await this.writeOutbox(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          eventType: INTERVIEW_NOTE_EVENT_TYPES.aiContextAdded,
          entityId: created.id,
          payload: {
            applicationId: created.applicationId,
            source: 'interview_note',
          },
        });
      }

      return created;
    });
  }

  async update(input: {
    organizationId: string;
    noteId: string;
    actorUserId: string;
    content?: string;
    rating?: number | null;
    includeInAiContext?: boolean;
  }): Promise<InterviewNoteRecord | null> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: interviewNote.id,
          includeInAiContext: interviewNote.includeInAiContext,
        })
        .from(interviewNote)
        .innerJoin(application, eq(application.id, interviewNote.applicationId))
        .where(
          and(
            eq(application.organizationId, input.organizationId),
            eq(interviewNote.id, input.noteId),
          ),
        )
        .limit(1)
        .for('update');

      if (!current) {
        return null;
      }

      const [updated] = await tx
        .update(interviewNote)
        .set({
          ...(input.content === undefined ? {} : { content: input.content }),
          ...(input.rating === undefined ? {} : { rating: input.rating }),
          ...(input.includeInAiContext === undefined
            ? {}
            : { includeInAiContext: input.includeInAiContext }),
          updatedAt: new Date(),
        })
        .where(eq(interviewNote.id, input.noteId))
        .returning();

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: INTERVIEW_NOTE_EVENT_TYPES.updated,
        entityId: updated.id,
        payload: {
          applicationId: updated.applicationId,
          hasRating: updated.rating !== null,
          includeInAiContext: updated.includeInAiContext,
        },
      });

      if (!current.includeInAiContext && updated.includeInAiContext) {
        await this.writeOutbox(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          eventType: INTERVIEW_NOTE_EVENT_TYPES.aiContextAdded,
          entityId: updated.id,
          payload: {
            applicationId: updated.applicationId,
            source: 'interview_note',
          },
        });
      }

      return updated;
    });
  }

  async listByApplication(
    organizationId: string,
    applicationId: string,
  ): Promise<InterviewNoteRecord[] | null> {
    const exists = await this.applicationExists(organizationId, applicationId);

    if (!exists) {
      return null;
    }

    return this.db
      .select()
      .from(interviewNote)
      .where(eq(interviewNote.applicationId, applicationId))
      .orderBy(asc(interviewNote.createdAt), asc(interviewNote.id));
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
      entityType: 'interview_note',
      entityId: input.entityId,
    });

    await this.writeOutbox(tx, input);
  }

  private async writeOutbox(
    tx: Transaction,
    input: {
      organizationId: string;
      actorUserId: string;
      eventType: string;
      entityId: string;
      payload: Record<string, unknown>;
    },
  ) {
    await tx.insert(outboxEvent).values({
      eventType: input.eventType,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entityType: 'interview_note',
      entityId: input.entityId,
      payload: input.payload,
    });
  }
}

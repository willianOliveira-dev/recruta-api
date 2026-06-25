import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { database } from '../../../config/database.config';
import { DRIZZLE } from '../../../database/drizzle/drizzle.module';
import {
  application,
  applicationStageHistory,
  auditLog,
  member,
  outboxEvent,
} from '../../../database/drizzle/schema';
import type { ApplicationStage } from '../../applications/domain/application-stage';
import type { MemberRole } from '../../members/domain/member-role';
import { PIPELINE_EVENT_TYPES } from '../domain/pipeline-events';

type Database = typeof database;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type PipelineApplicationRecord = typeof application.$inferSelect;
export type ApplicationStageHistoryRecord =
  typeof applicationStageHistory.$inferSelect;

export interface PipelineActorRecord {
  id: string;
  userId: string;
  role: MemberRole;
}

@Injectable()
export class PipelineRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findActorMember(
    organizationId: string,
    userId: string,
  ): Promise<PipelineActorRecord | null> {
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

  async moveStage(input: {
    organizationId: string;
    applicationId: string;
    actorUserId: string;
    toStage: ApplicationStage;
    reason: string | null;
  }): Promise<{
    application: PipelineApplicationRecord;
    history: ApplicationStageHistoryRecord;
  } | null> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(application)
        .where(
          and(
            eq(application.organizationId, input.organizationId),
            eq(application.id, input.applicationId),
          ),
        )
        .limit(1)
        .for('update');

      if (!current) {
        return null;
      }

      const now = new Date();
      const [updated] = await tx
        .update(application)
        .set({
          stage: input.toStage,
          stageEnteredAt: now,
          updatedAt: now,
        })
        .where(eq(application.id, current.id))
        .returning();

      const [history] = await tx
        .insert(applicationStageHistory)
        .values({
          applicationId: current.id,
          fromStage: current.stage,
          toStage: input.toStage,
          movedBy: input.actorUserId,
          reason: input.reason,
        })
        .returning();

      await this.writeAuditAndOutbox(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entityId: current.id,
        payload: {
          fromStage: current.stage,
          toStage: input.toStage,
          reasonProvided: Boolean(input.reason),
        },
      });

      return {
        application: updated,
        history,
      };
    });
  }

  async listHistory(
    organizationId: string,
    applicationId: string,
  ): Promise<ApplicationStageHistoryRecord[] | null> {
    const [applicationRecord] = await this.db
      .select({ id: application.id })
      .from(application)
      .where(
        and(
          eq(application.organizationId, organizationId),
          eq(application.id, applicationId),
        ),
      )
      .limit(1);

    if (!applicationRecord) {
      return null;
    }

    return this.db
      .select()
      .from(applicationStageHistory)
      .where(eq(applicationStageHistory.applicationId, applicationId))
      .orderBy(asc(applicationStageHistory.createdAt));
  }

  private async writeAuditAndOutbox(
    tx: Transaction,
    input: {
      organizationId: string;
      actorUserId: string;
      entityId: string;
      payload: Record<string, unknown>;
    },
  ) {
    await tx.insert(auditLog).values({
      organizationId: input.organizationId,
      userId: input.actorUserId,
      action: PIPELINE_EVENT_TYPES.stageChanged,
      entityType: 'application',
      entityId: input.entityId,
    });

    await tx.insert(outboxEvent).values({
      eventType: PIPELINE_EVENT_TYPES.stageChanged,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entityType: 'application',
      entityId: input.entityId,
      payload: input.payload,
    });
  }
}

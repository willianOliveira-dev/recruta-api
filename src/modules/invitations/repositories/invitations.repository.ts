import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import { database } from '../../../config/database.config';
import { DRIZZLE } from '../../../database/drizzle/drizzle.module';
import {
  auditLog,
  invitation,
  member,
  outboxEvent,
  session as sessionTable,
  user,
} from '../../../database/drizzle/schema';
import type { MemberRole } from '../../members/domain/member-role';
import {
  InvitationMemberAlreadyExistsError,
  PendingInvitationAlreadyExistsError,
} from '../domain/invitation-errors';
import { INVITATION_EVENT_TYPES } from '../domain/invitation-event';

type Database = typeof database;

export type InvitationRecord = typeof invitation.$inferSelect;

export interface InvitationActorRecord {
  id: string;
  userId: string;
  role: MemberRole;
}

interface CreateInvitationInput {
  organizationId: string;
  actorUserId: string;
  email: string;
  role: MemberRole;
  expiresAt: Date;
  now: Date;
}

interface ResendInvitationInput {
  organizationId: string;
  invitationId: string;
  actorUserId: string;
  expiresAt: Date;
}

interface CancelInvitationInput {
  organizationId: string;
  invitationId: string;
  actorUserId: string;
}

interface AcceptInvitationInput {
  organizationId: string;
  invitationId: string;
  userId: string;
  sessionToken: string;
  acceptedAt: Date;
}

@Injectable()
export class InvitationsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findActorMember(
    organizationId: string,
    userId: string,
  ): Promise<InvitationActorRecord | null> {
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

  async findById(
    organizationId: string,
    invitationId: string,
  ): Promise<InvitationRecord | null> {
    const [row] = await this.db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, organizationId),
          eq(invitation.id, invitationId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async create(input: CreateInvitationInput): Promise<InvitationRecord> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${this.lockKey(input.organizationId, input.email)})::bigint)`,
      );

      const [existingMember] = await tx
        .select({ id: member.id })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(
          and(
            eq(member.organizationId, input.organizationId),
            sql`lower(${user.email}) = ${input.email}`,
          ),
        )
        .limit(1)
        .for('update');

      if (existingMember) {
        throw new InvitationMemberAlreadyExistsError();
      }

      const [existingInvitation] = await tx
        .select({ id: invitation.id })
        .from(invitation)
        .where(
          and(
            eq(invitation.organizationId, input.organizationId),
            eq(invitation.email, input.email),
            eq(invitation.status, 'pending'),
            gt(invitation.expiresAt, input.now),
          ),
        )
        .limit(1)
        .for('update');

      if (existingInvitation) {
        throw new PendingInvitationAlreadyExistsError();
      }

      const [createdInvitation] = await tx
        .insert(invitation)
        .values({
          organizationId: input.organizationId,
          email: input.email,
          role: input.role,
          expiresAt: input.expiresAt,
          inviterId: input.actorUserId,
        })
        .returning();

      await tx.insert(auditLog).values({
        organizationId: input.organizationId,
        userId: input.actorUserId,
        action: INVITATION_EVENT_TYPES.invited,
        entityType: 'invitation',
        entityId: createdInvitation.id,
      });

      await tx.insert(outboxEvent).values({
        eventType: INVITATION_EVENT_TYPES.invited,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entityType: 'invitation',
        entityId: createdInvitation.id,
        payload: {
          invitationId: createdInvitation.id,
          email: createdInvitation.email,
          role: createdInvitation.role,
          expiresAt: createdInvitation.expiresAt.toISOString(),
        },
      });

      return createdInvitation;
    });
  }

  async resend(
    input: ResendInvitationInput,
  ): Promise<InvitationRecord | null> {
    return this.db.transaction(async (tx) => {
      const [updatedInvitation] = await tx
        .update(invitation)
        .set({
          status: 'pending',
          expiresAt: input.expiresAt,
        })
        .where(
          and(
            eq(invitation.organizationId, input.organizationId),
            eq(invitation.id, input.invitationId),
            eq(invitation.status, 'pending'),
          ),
        )
        .returning();

      if (!updatedInvitation) {
        return null;
      }

      await tx.insert(auditLog).values({
        organizationId: input.organizationId,
        userId: input.actorUserId,
        action: INVITATION_EVENT_TYPES.resent,
        entityType: 'invitation',
        entityId: input.invitationId,
      });

      await tx.insert(outboxEvent).values({
        eventType: INVITATION_EVENT_TYPES.resent,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entityType: 'invitation',
        entityId: input.invitationId,
        payload: {
          invitationId: updatedInvitation.id,
          email: updatedInvitation.email,
          role: updatedInvitation.role,
          expiresAt: updatedInvitation.expiresAt.toISOString(),
        },
      });

      return updatedInvitation;
    });
  }

  async cancel(
    input: CancelInvitationInput,
  ): Promise<InvitationRecord | null> {
    return this.db.transaction(async (tx) => {
      const [updatedInvitation] = await tx
        .update(invitation)
        .set({ status: 'canceled' })
        .where(
          and(
            eq(invitation.organizationId, input.organizationId),
            eq(invitation.id, input.invitationId),
            eq(invitation.status, 'pending'),
          ),
        )
        .returning();

      if (!updatedInvitation) {
        return null;
      }

      await tx.insert(auditLog).values({
        organizationId: input.organizationId,
        userId: input.actorUserId,
        action: INVITATION_EVENT_TYPES.canceled,
        entityType: 'invitation',
        entityId: input.invitationId,
      });

      await tx.insert(outboxEvent).values({
        eventType: INVITATION_EVENT_TYPES.canceled,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entityType: 'invitation',
        entityId: input.invitationId,
        payload: {
          invitationId: updatedInvitation.id,
          email: updatedInvitation.email,
          role: updatedInvitation.role,
        },
      });

      return updatedInvitation;
    });
  }

  async accept(
    input: AcceptInvitationInput,
  ): Promise<InvitationRecord | null> {
    return this.db.transaction(async (tx) => {
      const [invitationForLock] = await tx
        .select({ email: invitation.email })
        .from(invitation)
        .where(
          and(
            eq(invitation.organizationId, input.organizationId),
            eq(invitation.id, input.invitationId),
          ),
        )
        .limit(1);

      if (!invitationForLock) {
        return null;
      }

      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${this.lockKey(input.organizationId, invitationForLock.email)})::bigint)`,
      );

      const [targetInvitation] = await tx
        .select()
        .from(invitation)
        .where(
          and(
            eq(invitation.organizationId, input.organizationId),
            eq(invitation.id, input.invitationId),
          ),
        )
        .limit(1)
        .for('update');

      if (
        !targetInvitation ||
        targetInvitation.status !== 'pending' ||
        targetInvitation.expiresAt.getTime() <= input.acceptedAt.getTime()
      ) {
        return null;
      }

      const [existingMember] = await tx
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, input.organizationId),
            eq(member.userId, input.userId),
          ),
        )
        .limit(1)
        .for('update');

      if (existingMember) {
        throw new InvitationMemberAlreadyExistsError();
      }

      const [createdMember] = await tx
        .insert(member)
        .values({
          organizationId: input.organizationId,
          userId: input.userId,
          role: targetInvitation.role,
        })
        .returning({ id: member.id });

      const [updatedInvitation] = await tx
        .update(invitation)
        .set({ status: 'accepted' })
        .where(
          and(
            eq(invitation.organizationId, input.organizationId),
            eq(invitation.id, input.invitationId),
            eq(invitation.status, 'pending'),
          ),
        )
        .returning();

      await tx
        .update(sessionTable)
        .set({ activeOrganizationId: input.organizationId })
        .where(eq(sessionTable.token, input.sessionToken));

      await tx.insert(auditLog).values({
        organizationId: input.organizationId,
        userId: input.userId,
        action: INVITATION_EVENT_TYPES.accepted,
        entityType: 'invitation',
        entityId: input.invitationId,
      });

      await tx.insert(outboxEvent).values({
        eventType: INVITATION_EVENT_TYPES.accepted,
        organizationId: input.organizationId,
        actorUserId: input.userId,
        entityType: 'invitation',
        entityId: input.invitationId,
        payload: {
          invitationId: updatedInvitation.id,
          memberId: createdMember.id,
          email: updatedInvitation.email,
          role: updatedInvitation.role,
        },
      });

      return updatedInvitation;
    });
  }

  private lockKey(organizationId: string, email: string) {
    return `invitation:${organizationId}:${email}`;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq } from 'drizzle-orm';
import { database } from '../../../config/database.config';
import { DRIZZLE } from '../../../database/drizzle/drizzle.module';
import {
  auditLog,
  member,
  user,
} from '../../../database/drizzle/schema';
import { LastOrganizationOwnerError } from '../domain/member-errors';
import type { MemberRole } from '../domain/member-role';

type Database = typeof database;

export interface MemberRecord {
  member: typeof member.$inferSelect;
  user: typeof user.$inferSelect;
}

interface UpdateMemberRoleInput {
  organizationId: string;
  memberId: string;
  actorUserId: string;
  role: MemberRole;
}

interface RemoveMemberInput {
  organizationId: string;
  memberId: string;
  actorUserId: string;
}

@Injectable()
export class MembersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findByUser(
    organizationId: string,
    userId: string,
  ): Promise<MemberRecord | null> {
    const [row] = await this.db
      .select({
        member,
        user,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
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
    memberId: string,
  ): Promise<MemberRecord | null> {
    const [row] = await this.db
      .select({
        member,
        user,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(
        and(eq(member.organizationId, organizationId), eq(member.id, memberId)),
      )
      .limit(1);

    return row ?? null;
  }

  async listByOrganization(organizationId: string): Promise<MemberRecord[]> {
    return this.db
      .select({
        member,
        user,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, organizationId))
      .orderBy(asc(member.createdAt), asc(user.email));
  }

  async countOwners(organizationId: string): Promise<number> {
    const [ownersCount] = await this.db
      .select({ value: count(member.id) })
      .from(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.role, 'owner'),
        ),
      );

    return ownersCount?.value ?? 0;
  }

  async updateRole(input: UpdateMemberRoleInput): Promise<MemberRecord | null> {
    return this.db.transaction(async (tx) => {
      const ownerRows = await tx
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, input.organizationId),
            eq(member.role, 'owner'),
          ),
        )
        .for('update');

      const [target] = await tx
        .select({ role: member.role })
        .from(member)
        .where(
          and(
            eq(member.organizationId, input.organizationId),
            eq(member.id, input.memberId),
          ),
        )
        .limit(1)
        .for('update');

      if (!target) {
        return null;
      }

      if (
        target.role === 'owner' &&
        input.role !== 'owner' &&
        ownerRows.length <= 1
      ) {
        throw new LastOrganizationOwnerError();
      }

      const [updatedMember] = await tx
        .update(member)
        .set({ role: input.role })
        .where(
          and(
            eq(member.organizationId, input.organizationId),
            eq(member.id, input.memberId),
          ),
        )
        .returning();

      if (!updatedMember) {
        return null;
      }

      await tx.insert(auditLog).values({
        organizationId: input.organizationId,
        userId: input.actorUserId,
        action: 'member.role.changed',
        entityType: 'member',
        entityId: input.memberId,
      });

      const [row] = await tx
        .select({
          member,
          user,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(eq(member.id, input.memberId))
        .limit(1);

      return row ?? null;
    });
  }

  async remove(input: RemoveMemberInput): Promise<MemberRecord | null> {
    return this.db.transaction(async (tx) => {
      const ownerRows = await tx
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, input.organizationId),
            eq(member.role, 'owner'),
          ),
        )
        .for('update');

      const [row] = await tx
        .select({
          member,
          user,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(
          and(
            eq(member.organizationId, input.organizationId),
            eq(member.id, input.memberId),
          ),
        )
        .limit(1)
        .for('update');

      if (!row) {
        return null;
      }

      if (row.member.role === 'owner' && ownerRows.length <= 1) {
        throw new LastOrganizationOwnerError();
      }

      await tx
        .delete(member)
        .where(
          and(
            eq(member.organizationId, input.organizationId),
            eq(member.id, input.memberId),
          ),
        );

      await tx.insert(auditLog).values({
        organizationId: input.organizationId,
        userId: input.actorUserId,
        action: 'member.removed',
        entityType: 'member',
        entityId: input.memberId,
      });

      return row;
    });
  }
}

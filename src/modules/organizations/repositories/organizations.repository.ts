import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { database } from '../../../config/database.config';
import { DRIZZLE } from '../../../database/drizzle/drizzle.module';
import {
  auditLog,
  member,
  organization,
  organizationProfile,
  session,
} from '../../../database/drizzle/schema';
import type { OrganizationProfileDto } from '../dto/organization-profile.dto';

type Database = typeof database;

interface CreateOrganizationInput {
  name: string;
  slug: string;
  ownerUserId: string;
  sessionToken: string;
  profile?: OrganizationProfileDto;
}

@Injectable()
export class OrganizationsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async createWithOwner(input: CreateOrganizationInput) {
    return this.db.transaction(async (tx) => {
      const [createdOrganization] = await tx
        .insert(organization)
        .values({
          name: input.name,
          slug: input.slug,
          createdBy: input.ownerUserId,
        })
        .returning();

      const [createdMember] = await tx
        .insert(member)
        .values({
          organizationId: createdOrganization.id,
          userId: input.ownerUserId,
          role: 'owner',
        })
        .returning();

      if (input.profile) {
        await tx.insert(organizationProfile).values({
          organizationId: createdOrganization.id,
          ...input.profile,
        });
      }

      await tx
        .update(session)
        .set({ activeOrganizationId: createdOrganization.id })
        .where(eq(session.token, input.sessionToken));

      await tx.insert(auditLog).values({
        organizationId: createdOrganization.id,
        userId: input.ownerUserId,
        action: 'organization.created',
        entityType: 'organization',
        entityId: createdOrganization.id,
      });

      const [createdProfile] = input.profile
        ? await tx
            .select()
            .from(organizationProfile)
            .where(
              eq(organizationProfile.organizationId, createdOrganization.id),
            )
            .limit(1)
        : [];

      return {
        organization: createdOrganization,
        member: createdMember,
        profile: createdProfile ?? null,
      };
    });
  }

  async findScopedOrganization(userId: string, organizationId: string) {
    const [row] = await this.db
      .select({
        organization,
        member,
        profile: organizationProfile,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .leftJoin(
        organizationProfile,
        eq(organizationProfile.organizationId, organization.id),
      )
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, organizationId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async upsertProfile(
    organizationId: string,
    actorUserId: string,
    profile: OrganizationProfileDto,
  ) {
    return this.db.transaction(async (tx) => {
      const [savedProfile] = await tx
        .insert(organizationProfile)
        .values({
          organizationId,
          ...profile,
        })
        .onConflictDoUpdate({
          target: organizationProfile.organizationId,
          set: {
            ...profile,
            updatedAt: new Date(),
          },
        })
        .returning();

      await tx.insert(auditLog).values({
        organizationId,
        userId: actorUserId,
        action: 'organization.profile.updated',
        entityType: 'organization',
        entityId: organizationId,
      });

      return savedProfile;
    });
  }
}

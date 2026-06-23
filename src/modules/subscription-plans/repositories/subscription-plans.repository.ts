import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { database } from '../../../config/database.config';
import { DRIZZLE } from '../../../database/drizzle/drizzle.module';
import {
  candidate,
  job,
  member,
  organizationAiUsage,
  organizationSubscription,
  subscriptionPlan,
} from '../../../database/drizzle/schema';
import type { CommercialPlanSlug } from '../domain/subscription-plan';

type Database = typeof database;

export type SubscriptionPlanRecord = typeof subscriptionPlan.$inferSelect;
export type OrganizationSubscriptionRecord =
  typeof organizationSubscription.$inferSelect;

export interface PlanUsage {
  currentUsers: number;
  activeJobs: number;
  candidatesThisMonth: number;
  monthlyAiTokensUsed: number;
}

export interface OrganizationPlanContext {
  subscription: OrganizationSubscriptionRecord;
  plan: SubscriptionPlanRecord;
}

@Injectable()
export class SubscriptionPlansRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listActive(): Promise<SubscriptionPlanRecord[]> {
    return this.db
      .select()
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.isActive, true))
      .orderBy(subscriptionPlan.priceInCents);
  }

  async findActiveBySlug(
    slug: CommercialPlanSlug,
  ): Promise<SubscriptionPlanRecord | null> {
    const [plan] = await this.db
      .select()
      .from(subscriptionPlan)
      .where(and(eq(subscriptionPlan.slug, slug), eq(subscriptionPlan.isActive, true)))
      .limit(1);

    return plan ?? null;
  }

  async getOrganizationPlanContext(
    organizationId: string,
  ): Promise<OrganizationPlanContext | null> {
    const [row] = await this.db
      .select({
        subscription: organizationSubscription,
        plan: subscriptionPlan,
      })
      .from(organizationSubscription)
      .innerJoin(
        subscriptionPlan,
        eq(organizationSubscription.planId, subscriptionPlan.id),
      )
      .where(eq(organizationSubscription.organizationId, organizationId))
      .limit(1);

    return row ?? null;
  }

  async getUsage(organizationId: string, now = new Date()): Promise<PlanUsage> {
    const [membersCount, jobsCount, candidatesCount, aiUsage] =
      await Promise.all([
        this.db
          .select({ value: count(member.id) })
          .from(member)
          .where(eq(member.organizationId, organizationId)),
        this.db
          .select({ value: count(job.id) })
          .from(job)
          .where(
            and(
              eq(job.organizationId, organizationId),
              inArray(job.status, ['published', 'paused']),
            ),
          ),
        this.db
          .select({ value: count(candidate.id) })
          .from(candidate)
          .where(
            and(
              eq(candidate.organizationId, organizationId),
              gte(candidate.createdAt, this.startOfMonth(now)),
              lt(candidate.createdAt, this.startOfNextMonth(now)),
            ),
          ),
        this.db
          .select({
            value: sql<number>`coalesce(sum(${organizationAiUsage.promptTokens} + ${organizationAiUsage.completionTokens} + ${organizationAiUsage.embeddingTokens} - ${organizationAiUsage.cachedTokens}), 0)::int`,
          })
          .from(organizationAiUsage)
          .where(
            and(
              eq(organizationAiUsage.organizationId, organizationId),
              eq(organizationAiUsage.year, now.getUTCFullYear()),
              eq(organizationAiUsage.month, now.getUTCMonth() + 1),
            ),
          ),
      ]);

    return {
      currentUsers: membersCount[0]?.value ?? 0,
      activeJobs: jobsCount[0]?.value ?? 0,
      candidatesThisMonth: candidatesCount[0]?.value ?? 0,
      monthlyAiTokensUsed: aiUsage[0]?.value ?? 0,
    };
  }

  private startOfMonth(now: Date) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  private startOfNextMonth(now: Date) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  }
}


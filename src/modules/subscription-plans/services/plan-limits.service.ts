import { ForbiddenException, Injectable } from '@nestjs/common';
import type {
  PlanUsage,
  SubscriptionPlanRecord,
} from '../repositories/subscription-plans.repository';
import { SubscriptionPlansRepository } from '../repositories/subscription-plans.repository';

export interface MembershipCapacity {
  currentUsers: number;
  maxUsers: number | null;
}

export interface OrganizationLimitSnapshot {
  plan: SubscriptionPlanRecord | null;
  hasActiveSubscription: boolean;
  usage: PlanUsage;
}

@Injectable()
export class PlanLimitsService {
  constructor(
    private readonly subscriptionPlansRepository: SubscriptionPlansRepository,
  ) {}

  async getOrganizationLimitSnapshot(
    organizationId: string,
  ): Promise<OrganizationLimitSnapshot> {
    const [context, usage] = await Promise.all([
      this.subscriptionPlansRepository.getOrganizationPlanContext(
        organizationId,
      ),
      this.subscriptionPlansRepository.getUsage(organizationId),
    ]);

    if (!context || !this.isSubscriptionUsable(context.subscription)) {
      return {
        plan: null,
        hasActiveSubscription: false,
        usage,
      };
    }

    return {
      plan: context.plan,
      hasActiveSubscription: true,
      usage,
    };
  }

  async getMembershipCapacity(
    organizationId: string,
  ): Promise<MembershipCapacity> {
    const snapshot = await this.getOrganizationLimitSnapshot(organizationId);

    return {
      currentUsers: snapshot.usage.currentUsers,
      maxUsers: snapshot.plan?.maxUsers ?? null,
    };
  }

  async assertCanAddMember(organizationId: string): Promise<void> {
    const snapshot = await this.getOrganizationLimitSnapshot(organizationId);
    const plan = this.requirePlan(snapshot);

    if (snapshot.usage.currentUsers < plan.maxUsers) {
      return;
    }

    this.throwLimitExceeded('maxUsers', 'Organization user limit exceeded');
  }

  async assertCanPublishJob(organizationId: string): Promise<void> {
    const snapshot = await this.getOrganizationLimitSnapshot(organizationId);
    const plan = this.requirePlan(snapshot);

    if (snapshot.usage.activeJobs < plan.maxJobs) {
      return;
    }

    this.throwLimitExceeded('maxJobs', 'Organization active job limit exceeded');
  }

  async assertCanCreateCandidate(organizationId: string): Promise<void> {
    const snapshot = await this.getOrganizationLimitSnapshot(organizationId);
    const plan = this.requirePlan(snapshot);

    if (snapshot.usage.candidatesThisMonth < plan.maxCandidatesPerMonth) {
      return;
    }

    this.throwLimitExceeded(
      'maxCandidatesPerMonth',
      'Organization monthly candidate limit exceeded',
    );
  }

  async assertCanQueueAiTokens(
    organizationId: string,
    requestedTokens: number,
  ): Promise<void> {
    const snapshot = await this.getOrganizationLimitSnapshot(organizationId);
    const plan = this.requirePlan(snapshot);

    if (snapshot.usage.monthlyAiTokensUsed + requestedTokens <= plan.monthlyAiTokens) {
      return;
    }

    this.throwLimitExceeded(
      'monthlyAiTokens',
      'Organization monthly AI token limit exceeded',
    );
  }

  async assertApiAccess(organizationId: string): Promise<void> {
    const snapshot = await this.getOrganizationLimitSnapshot(organizationId);
    const plan = this.requirePlan(snapshot);

    if (plan.apiAccess) {
      return;
    }

    this.throwLimitExceeded('apiAccess', 'API access is not available for this plan');
  }

  private requirePlan(snapshot: OrganizationLimitSnapshot): SubscriptionPlanRecord {
    if (snapshot.plan && snapshot.hasActiveSubscription) {
      return snapshot.plan;
    }

    throw new ForbiddenException({
      code: 'ORGANIZATION_SUBSCRIPTION_REQUIRED',
      message: 'Active subscription plan is required',
    });
  }

  private isSubscriptionUsable(
    subscription: { status: string; isActive: boolean; trialEndsAt: Date | null },
    now = new Date(),
  ) {
    if (!subscription.isActive) {
      return false;
    }

    if (subscription.status === 'active') {
      return true;
    }

    return (
      subscription.status === 'trialing' &&
      (!subscription.trialEndsAt || subscription.trialEndsAt.getTime() > now.getTime())
    );
  }

  private throwLimitExceeded(limit: string, message: string): never {
    throw new ForbiddenException({
      code: 'PLAN_LIMIT_EXCEEDED',
      limit,
      message,
    });
  }
}


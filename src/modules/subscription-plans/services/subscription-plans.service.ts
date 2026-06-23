import { Injectable, NotFoundException } from '@nestjs/common';
import {
  isCommercialPlanSlug,
  type CommercialPlanSlug,
} from '../domain/subscription-plan';
import type {
  OrganizationPlanLimitsResponseDto,
  PlanUsageResponseDto,
} from '../dto/plan-limit-response.dto';
import type {
  PlanLimitsResponseDto,
  SubscriptionPlanResponseDto,
  SubscriptionPlansListResponseDto,
} from '../dto/subscription-plan-response.dto';
import {
  type PlanUsage,
  type SubscriptionPlanRecord,
  SubscriptionPlansRepository,
} from '../repositories/subscription-plans.repository';
import { PlanLimitsService } from './plan-limits.service';

@Injectable()
export class SubscriptionPlansService {
  constructor(
    private readonly subscriptionPlansRepository: SubscriptionPlansRepository,
    private readonly planLimitsService: PlanLimitsService,
  ) {}

  async listActive(): Promise<SubscriptionPlansListResponseDto> {
    const plans = await this.subscriptionPlansRepository.listActive();

    return {
      plans: plans.map((plan) => this.toPlanResponse(plan)),
    };
  }

  async getPlanLimits(slug: string): Promise<SubscriptionPlanResponseDto> {
    if (!isCommercialPlanSlug(slug)) {
      this.throwPlanNotFound();
    }

    const plan = await this.subscriptionPlansRepository.findActiveBySlug(slug);

    if (!plan) {
      this.throwPlanNotFound();
    }

    return this.toPlanResponse(plan);
  }

  async getOrganizationLimits(
    organizationId: string,
  ): Promise<OrganizationPlanLimitsResponseDto> {
    const snapshot =
      await this.planLimitsService.getOrganizationLimitSnapshot(organizationId);

    return {
      plan: snapshot.plan ? this.toPlanResponse(snapshot.plan) : null,
      hasActiveSubscription: snapshot.hasActiveSubscription,
      usage: this.toUsageResponse(snapshot.usage),
    };
  }

  toPlanResponse(plan: SubscriptionPlanRecord): SubscriptionPlanResponseDto {
    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug as CommercialPlanSlug,
      description: plan.description ?? null,
      priceInCents: plan.priceInCents,
      currency: plan.currency,
      billingPeriodMonths: plan.billingPeriodMonths,
      trialDays: plan.trialDays,
      pricingJustification: plan.pricingJustification ?? null,
      isActive: plan.isActive,
      limits: this.toLimitsResponse(plan),
    };
  }

  private toLimitsResponse(plan: SubscriptionPlanRecord): PlanLimitsResponseDto {
    return {
      maxUsers: plan.maxUsers,
      maxJobs: plan.maxJobs,
      monthlyAiTokens: plan.monthlyAiTokens,
      maxCandidatesPerMonth: plan.maxCandidatesPerMonth,
      customCareerPage: plan.customCareerPage,
      apiAccess: plan.apiAccess,
      prioritySupport: plan.prioritySupport,
    };
  }

  private toUsageResponse(usage: PlanUsage): PlanUsageResponseDto {
    return {
      currentUsers: usage.currentUsers,
      activeJobs: usage.activeJobs,
      candidatesThisMonth: usage.candidatesThisMonth,
      monthlyAiTokensUsed: usage.monthlyAiTokensUsed,
    };
  }

  private throwPlanNotFound(): never {
    throw new NotFoundException({
      code: 'SUBSCRIPTION_PLAN_NOT_FOUND',
      message: 'Subscription plan was not found',
    });
  }
}


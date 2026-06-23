import { ForbiddenException } from '@nestjs/common';
import type { SubscriptionPlansRepository } from '../repositories/subscription-plans.repository';
import { PlanLimitsService } from '../services/plan-limits.service';

jest.mock('../repositories/subscription-plans.repository', () => ({
  SubscriptionPlansRepository: class SubscriptionPlansRepository {},
}));

interface RepositoryMock {
  getOrganizationPlanContext: jest.Mock;
  getUsage: jest.Mock;
}

const organizationId = '01972194-7d9f-7000-9c9e-b2abdc1d88e0';
const futureDate = new Date('2099-07-06T12:00:00.000Z');
const pastDate = new Date('2020-07-06T12:00:00.000Z');

const usage = {
  currentUsers: 1,
  activeJobs: 2,
  candidatesThisMonth: 10,
  monthlyAiTokensUsed: 1000,
};

const plan = {
  id: '01972194-7d9f-7000-9c9e-b2abdc1d8b01',
  name: 'Básico',
  slug: 'basic',
  description: null,
  priceInCents: 14900,
  currency: 'BRL',
  billingPeriodMonths: 1,
  trialDays: 14,
  maxUsers: 2,
  maxJobs: 3,
  monthlyAiTokens: 200000,
  maxCandidatesPerMonth: 100,
  customCareerPage: false,
  apiAccess: false,
  prioritySupport: false,
  gatewayPlanId: null,
  pricingJustification: null,
  isActive: true,
  createdAt: new Date('2026-06-22T12:00:00.000Z'),
  updatedAt: new Date('2026-06-22T12:00:00.000Z'),
};

const subscription = {
  organizationId,
  planId: plan.id,
  pendingPlanId: null,
  status: 'trialing',
  isActive: true,
  trialEndsAt: futureDate,
  currentPeriodStart: new Date('2026-06-22T12:00:00.000Z'),
  currentPeriodEnd: futureDate,
  activatedAt: null,
  canceledAt: null,
  gatewayCustomerId: null,
  gatewaySubscriptionId: null,
  pendingGatewaySubscriptionId: null,
  gatewayPlanId: null,
  checkoutUrl: null,
  externalReference: null,
  createdAt: new Date('2026-06-22T12:00:00.000Z'),
  updatedAt: new Date('2026-06-22T12:00:00.000Z'),
};

describe('PlanLimitsService', () => {
  let repository: RepositoryMock;
  let service: PlanLimitsService;

  beforeEach(() => {
    repository = {
      getOrganizationPlanContext: jest.fn(),
      getUsage: jest.fn(),
    };
    service = new PlanLimitsService(
      repository as unknown as SubscriptionPlansRepository,
    );
  });

  it('returns active trial limits while trial is valid', async () => {
    repository.getOrganizationPlanContext.mockResolvedValue({
      subscription,
      plan,
    });
    repository.getUsage.mockResolvedValue(usage);

    const snapshot =
      await service.getOrganizationLimitSnapshot(organizationId);

    expect(snapshot.hasActiveSubscription).toBe(true);
    expect(snapshot.plan?.slug).toBe('basic');
    expect(snapshot.usage).toEqual(usage);
  });

  it('treats expired trials as inactive subscriptions', async () => {
    repository.getOrganizationPlanContext.mockResolvedValue({
      subscription: { ...subscription, trialEndsAt: pastDate },
      plan,
    });
    repository.getUsage.mockResolvedValue(usage);

    const snapshot =
      await service.getOrganizationLimitSnapshot(organizationId);

    expect(snapshot.hasActiveSubscription).toBe(false);
    expect(snapshot.plan).toBeNull();
  });

  it('rejects adding members when the plan user limit is reached', async () => {
    repository.getOrganizationPlanContext.mockResolvedValue({
      subscription,
      plan,
    });
    repository.getUsage.mockResolvedValue({ ...usage, currentUsers: 2 });

    await expect(service.assertCanAddMember(organizationId)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects API access when the current plan does not include it', async () => {
    repository.getOrganizationPlanContext.mockResolvedValue({
      subscription,
      plan,
    });
    repository.getUsage.mockResolvedValue(usage);

    await expect(service.assertApiAccess(organizationId)).rejects.toThrow(
      ForbiddenException,
    );
  });
});

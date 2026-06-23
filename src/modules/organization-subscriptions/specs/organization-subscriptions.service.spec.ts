import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ApplicationLogger } from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import type { PlanLimitsService } from '../../subscription-plans/services/plan-limits.service';
import type { SubscriptionPlansService } from '../../subscription-plans/services/subscription-plans.service';
import { MercadoPagoNotConfiguredError } from '../domain/mercado-pago-errors';
import type { MercadoPagoService } from '../integrations/mercado-pago.service';
import type { OrganizationSubscriptionsRepository } from '../repositories/organization-subscriptions.repository';
import { OrganizationSubscriptionsService } from '../services/organization-subscriptions.service';

jest.mock('../repositories/organization-subscriptions.repository', () => ({
  OrganizationSubscriptionsRepository:
    class OrganizationSubscriptionsRepository {},
}));

jest.mock('../../subscription-plans/services/subscription-plans.service', () => ({
  SubscriptionPlansService: class SubscriptionPlansService {},
}));

jest.mock('../../subscription-plans/services/plan-limits.service', () => ({
  PlanLimitsService: class PlanLimitsService {},
}));

jest.mock('../integrations/mercado-pago.service', () => ({
  MercadoPagoService: class MercadoPagoService {},
}));

interface RepositoryMock {
  findActorMember: jest.Mock;
  findCurrent: jest.Mock;
  findPlanById: jest.Mock;
  findActivePlanBySlug: jest.Mock;
  createTrial: jest.Mock;
  preparePlanChange: jest.Mock;
  reconcileAuthorizedPayment: jest.Mock;
}

interface SubscriptionPlansServiceMock {
  toPlanResponse: jest.Mock;
}

interface PlanLimitsServiceMock {
  getOrganizationLimitSnapshot: jest.Mock;
}

interface MercadoPagoServiceMock {
  createPreapproval: jest.Mock;
  getAuthorizedPayment: jest.Mock;
  validateWebhookSignature: jest.Mock;
}

interface LoggerMock {
  log: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

const organizationId = '01972194-7d9f-7000-9c9e-b2abdc1d88e0';
const actorUserId = '01972194-7d9f-7000-9c9e-b2abdc1d88de';
const planId = '01972194-7d9f-7000-9c9e-b2abdc1d8b01';
const now = new Date('2026-06-22T12:00:00.000Z');

const session: AuthenticatedSession = {
  user: {
    id: actorUserId,
    email: 'owner@recruta.test',
    name: 'Owner',
  },
  session: {
    id: '01972194-7d9f-7000-9c9e-b2abdc1d88df',
    token: 'session-token',
    activeOrganizationId: organizationId,
  },
};

const basicPlan = {
  id: planId,
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
  gatewayPlanId: 'mp-basic',
  pricingJustification: null,
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

const subscription = {
  organizationId,
  planId,
  pendingPlanId: null,
  status: 'trialing',
  isActive: true,
  trialEndsAt: new Date('2026-07-06T12:00:00.000Z'),
  currentPeriodStart: now,
  currentPeriodEnd: new Date('2026-07-06T12:00:00.000Z'),
  activatedAt: null,
  canceledAt: null,
  gatewayCustomerId: null,
  gatewaySubscriptionId: null,
  pendingGatewaySubscriptionId: null,
  gatewayPlanId: null,
  checkoutUrl: null,
  externalReference: null,
  createdAt: now,
  updatedAt: now,
};

describe('OrganizationSubscriptionsService', () => {
  let repository: RepositoryMock;
  let subscriptionPlansService: SubscriptionPlansServiceMock;
  let planLimitsService: PlanLimitsServiceMock;
  let mercadoPagoService: MercadoPagoServiceMock;
  let logger: LoggerMock;
  let service: OrganizationSubscriptionsService;

  beforeEach(() => {
    repository = {
      findActorMember: jest.fn(),
      findCurrent: jest.fn(),
      findPlanById: jest.fn(),
      findActivePlanBySlug: jest.fn(),
      createTrial: jest.fn(),
      preparePlanChange: jest.fn(),
      reconcileAuthorizedPayment: jest.fn(),
    };
    subscriptionPlansService = {
      toPlanResponse: jest.fn((plan) => ({
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        priceInCents: plan.priceInCents,
        currency: plan.currency,
        billingPeriodMonths: plan.billingPeriodMonths,
        trialDays: plan.trialDays,
        description: plan.description,
        pricingJustification: plan.pricingJustification,
        isActive: plan.isActive,
        limits: {
          maxUsers: plan.maxUsers,
          maxJobs: plan.maxJobs,
          monthlyAiTokens: plan.monthlyAiTokens,
          maxCandidatesPerMonth: plan.maxCandidatesPerMonth,
          customCareerPage: plan.customCareerPage,
          apiAccess: plan.apiAccess,
          prioritySupport: plan.prioritySupport,
        },
      })),
    };
    planLimitsService = {
      getOrganizationLimitSnapshot: jest.fn().mockResolvedValue({
        hasActiveSubscription: true,
        plan: basicPlan,
        usage: {
          currentUsers: 1,
          activeJobs: 0,
          candidatesThisMonth: 0,
          monthlyAiTokensUsed: 0,
        },
      }),
    };
    mercadoPagoService = {
      createPreapproval: jest.fn(),
      getAuthorizedPayment: jest.fn(),
      validateWebhookSignature: jest.fn(),
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new OrganizationSubscriptionsService(
      repository as unknown as OrganizationSubscriptionsRepository,
      subscriptionPlansService as unknown as SubscriptionPlansService,
      planLimitsService as unknown as PlanLimitsService,
      mercadoPagoService as unknown as MercadoPagoService,
      logger as unknown as ApplicationLogger,
    );
  });

  it('applies a trial for organization owners', async () => {
    repository.findActorMember.mockResolvedValue({
      id: 'member-id',
      userId: actorUserId,
      role: 'owner',
    });
    repository.findCurrent
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ subscription, plan: basicPlan });
    repository.findActivePlanBySlug.mockResolvedValue(basicPlan);
    repository.createTrial.mockResolvedValue(subscription);

    const response = await service.applyTrial(session);

    expect(response.status).toBe('trialing');
    expect(repository.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        actorUserId,
        planId,
        trialEndsAt: expect.any(Date),
      }),
    );
  });

  it('rejects trial application from non-owner members', async () => {
    repository.findActorMember.mockResolvedValue({
      id: 'member-id',
      userId: actorUserId,
      role: 'recruiter',
    });

    await expect(service.applyTrial(session)).rejects.toThrow(
      ForbiddenException,
    );
    expect(repository.createTrial).not.toHaveBeenCalled();
  });

  it('prepares a Mercado Pago preapproval for plan changes', async () => {
    repository.findActorMember.mockResolvedValue({
      id: 'member-id',
      userId: actorUserId,
      role: 'owner',
    });
    repository.findCurrent
      .mockResolvedValueOnce({ subscription, plan: basicPlan })
      .mockResolvedValueOnce({ subscription, plan: basicPlan })
      .mockResolvedValueOnce({
        subscription: {
          ...subscription,
          pendingPlanId: planId,
          pendingGatewaySubscriptionId: 'mp-preapproval-id',
          checkoutUrl: 'https://checkout.test',
        },
        plan: basicPlan,
      });
    repository.findActivePlanBySlug.mockResolvedValue(basicPlan);
    repository.findPlanById.mockResolvedValue(basicPlan);
    mercadoPagoService.createPreapproval.mockResolvedValue({
      id: 'mp-preapproval-id',
      status: 'pending',
      initPoint: 'https://checkout.test',
      sandboxInitPoint: null,
    });
    repository.preparePlanChange.mockResolvedValue({
      ...subscription,
      pendingPlanId: planId,
      pendingGatewaySubscriptionId: 'mp-preapproval-id',
      checkoutUrl: 'https://checkout.test',
    });

    const response = await service.preparePlanChange(session, {
      planSlug: 'basic',
    });

    expect(response.checkoutUrl).toBe('https://checkout.test');
    expect(mercadoPagoService.createPreapproval).toHaveBeenCalledWith(
      expect.objectContaining({
        amountInCents: 14900,
        payerEmail: 'owner@recruta.test',
      }),
    );
    expect(repository.preparePlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingGatewaySubscriptionId: 'mp-preapproval-id',
        checkoutUrl: 'https://checkout.test',
      }),
    );
  });

  it('maps missing Mercado Pago configuration to service unavailable', async () => {
    repository.findActorMember.mockResolvedValue({
      id: 'member-id',
      userId: actorUserId,
      role: 'owner',
    });
    repository.findCurrent.mockResolvedValue({ subscription, plan: basicPlan });
    repository.findActivePlanBySlug.mockResolvedValue(basicPlan);
    mercadoPagoService.createPreapproval.mockRejectedValue(
      new MercadoPagoNotConfiguredError(),
    );

    await expect(
      service.preparePlanChange(session, { planSlug: 'basic' }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('reconciles Mercado Pago authorized payment webhooks', async () => {
    mercadoPagoService.validateWebhookSignature.mockReturnValue(true);
    mercadoPagoService.getAuthorizedPayment.mockResolvedValue({
      id: 'authorized-payment-id',
      paymentId: 'payment-id',
      preapprovalId: 'mp-preapproval-id',
      status: 'processed',
      statusDetail: 'accredited',
      transactionAmount: 149,
      currency: 'BRL',
      payload: {
        id: 'authorized-payment-id',
        status: 'processed',
      },
    });
    repository.reconcileAuthorizedPayment.mockResolvedValue({
      processed: true,
      organizationId,
    });

    const response = await service.acceptMercadoPagoWebhook({
      dto: {
        id: 'notification-id',
        type: 'subscription_authorized_payment',
        action: 'updated',
        data: {
          id: 'authorized-payment-id',
        },
      },
      xSignature: 'ts=123,v1=signature',
      xRequestId: 'request-id',
      dataId: 'authorized-payment-id',
    });

    expect(response).toEqual({ accepted: true });
    expect(mercadoPagoService.getAuthorizedPayment).toHaveBeenCalledWith(
      'authorized-payment-id',
    );
    expect(repository.reconcileAuthorizedPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'notification-id',
        paymentId: 'payment-id',
        preapprovalId: 'mp-preapproval-id',
        amountInCents: 14900,
        currency: 'BRL',
        paymentStatus: 'paid',
      }),
    );
  });
});

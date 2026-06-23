import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  APP_LOGGER,
  type ApplicationLogger,
} from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import { MEMBER_MANAGER_ROLES } from '../../members/domain/member-role';
import { PlanLimitsService } from '../../subscription-plans/services/plan-limits.service';
import { SubscriptionPlansService } from '../../subscription-plans/services/subscription-plans.service';
import {
  MercadoPagoNotConfiguredError,
  MercadoPagoRequestError,
} from '../domain/mercado-pago-errors';
import type { MercadoPagoWebhookDto } from '../dto/mercado-pago-webhook.dto';
import type { PreparePlanChangeDto } from '../dto/prepare-plan-change.dto';
import type {
  OrganizationSubscriptionResponseDto,
  PreparedPlanChangeResponseDto,
} from '../dto/organization-subscription-response.dto';
import { MercadoPagoService } from '../integrations/mercado-pago.service';
import {
  type OrganizationSubscriptionRecord,
  OrganizationSubscriptionsRepository,
  type OrganizationSubscriptionWithPlan,
  type SubscriptionActorRecord,
  type SubscriptionPlanRecord,
} from '../repositories/organization-subscriptions.repository';

@Injectable()
export class OrganizationSubscriptionsService {
  constructor(
    private readonly organizationSubscriptionsRepository: OrganizationSubscriptionsRepository,
    private readonly subscriptionPlansService: SubscriptionPlansService,
    private readonly planLimitsService: PlanLimitsService,
    private readonly mercadoPagoService: MercadoPagoService,
    @Inject(APP_LOGGER)
    private readonly logger: ApplicationLogger,
  ) {}

  async getCurrent(
    session: AuthenticatedSession,
  ): Promise<OrganizationSubscriptionResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.getScopedActor(session, organizationId);

    return this.buildResponse(organizationId);
  }

  async applyTrial(
    session: AuthenticatedSession,
  ): Promise<OrganizationSubscriptionResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManageSubscription(actor, session.user.id, organizationId);

    const current =
      await this.organizationSubscriptionsRepository.findCurrent(organizationId);

    if (current) {
      this.assertTrialCanBeReused(current.subscription);
      return this.buildResponse(organizationId);
    }

    const basicPlan =
      await this.organizationSubscriptionsRepository.findActivePlanBySlug(
        'basic',
      );

    if (!basicPlan) {
      throw new NotFoundException({
        code: 'SUBSCRIPTION_PLAN_NOT_FOUND',
        message: 'Basic subscription plan was not found',
      });
    }

    const now = new Date();
    const trialEndsAt = this.addDays(now, basicPlan.trialDays);

    await this.organizationSubscriptionsRepository.createTrial({
      organizationId,
      actorUserId: session.user.id,
      planId: basicPlan.id,
      now,
      trialEndsAt,
    });

    this.logger.log(
      {
        event: 'organization_subscription.trial_started',
        organizationId,
        actorUserId: session.user.id,
        planSlug: basicPlan.slug,
        trialEndsAt: trialEndsAt.toISOString(),
      },
      'OrganizationSubscriptionsService',
    );

    return this.buildResponse(organizationId);
  }

  async preparePlanChange(
    session: AuthenticatedSession,
    dto: PreparePlanChangeDto,
  ): Promise<PreparedPlanChangeResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManageSubscription(actor, session.user.id, organizationId);

    await this.ensureTrialExists(session, organizationId);

    const targetPlan =
      await this.organizationSubscriptionsRepository.findActivePlanBySlug(
        dto.planSlug,
      );

    if (!targetPlan) {
      throw new NotFoundException({
        code: 'SUBSCRIPTION_PLAN_NOT_FOUND',
        message: 'Subscription plan was not found',
      });
    }

    const current =
      await this.organizationSubscriptionsRepository.findCurrent(organizationId);

    if (
      current?.subscription.pendingPlanId === targetPlan.id &&
      current.subscription.checkoutUrl
    ) {
      return this.buildPreparedResponse(organizationId, current.subscription.checkoutUrl);
    }

    const externalReference = this.externalReference(organizationId, targetPlan);
    const preapproval = await this.createPreapprovalSafely({
      organizationId,
      targetPlan,
      payerEmail: session.user.email,
      externalReference,
    });
    const checkoutUrl = preapproval.initPoint ?? preapproval.sandboxInitPoint;

    if (!checkoutUrl) {
      throw new BadGatewayException({
        code: 'MERCADO_PAGO_CHECKOUT_URL_MISSING',
        message: 'Mercado Pago did not return a checkout URL',
      });
    }

    const updated =
      await this.organizationSubscriptionsRepository.preparePlanChange({
        organizationId,
        actorUserId: session.user.id,
        pendingPlanId: targetPlan.id,
        pendingGatewaySubscriptionId: preapproval.id,
        gatewayPlanId: targetPlan.gatewayPlanId,
        checkoutUrl,
        externalReference,
      });

    if (!updated) {
      throw new ConflictException({
        code: 'ORGANIZATION_SUBSCRIPTION_STATE_CONFLICT',
        message: 'Organization subscription changed before plan preparation',
      });
    }

    this.logger.log(
      {
        event: 'organization_subscription.plan_change_prepared',
        organizationId,
        actorUserId: session.user.id,
        planSlug: targetPlan.slug,
        pendingGatewaySubscriptionId: preapproval.id,
      },
      'OrganizationSubscriptionsService',
    );

    return this.buildPreparedResponse(organizationId, checkoutUrl);
  }

  async acceptMercadoPagoWebhook(input: {
    dto: MercadoPagoWebhookDto;
    xSignature?: string | string[];
    xRequestId?: string | string[];
    dataId?: string;
  }): Promise<{ accepted: true }> {
    const valid = this.mercadoPagoService.validateWebhookSignature(input);

    if (!valid) {
      throw new ForbiddenException({
        code: 'MERCADO_PAGO_WEBHOOK_SIGNATURE_INVALID',
        message: 'Mercado Pago webhook signature is invalid',
      });
    }

    if (
      input.dto.type !== 'subscription_authorized_payment' ||
      !input.dataId
    ) {
      this.logger.log(
        {
          event: 'organization_subscription.mercado_pago_webhook_accepted',
          type: input.dto.type,
          action: input.dto.action,
          dataId: input.dataId,
        },
        'OrganizationSubscriptionsService',
      );

      return { accepted: true };
    }

    const authorizedPayment = await this.getAuthorizedPaymentSafely(input.dataId);
    const paymentStatus = this.mapAuthorizedPaymentStatus(
      authorizedPayment.status,
      authorizedPayment.statusDetail,
    );

    const result =
      await this.organizationSubscriptionsRepository.reconcileAuthorizedPayment({
        eventId: String(input.dto.id ?? `${input.dto.type}:${input.dataId}`),
        eventType: input.dto.type,
        action: input.dto.action ?? null,
        authorizedPaymentId: authorizedPayment.id,
        paymentId: authorizedPayment.paymentId,
        preapprovalId: authorizedPayment.preapprovalId,
        amountInCents:
          authorizedPayment.transactionAmount === null
            ? 0
            : Math.round(authorizedPayment.transactionAmount * 100),
        currency: authorizedPayment.currency ?? 'BRL',
        paymentStatus,
        rawStatus: authorizedPayment.status,
        rawStatusDetail: authorizedPayment.statusDetail,
        payload: authorizedPayment.payload,
        processedAt: new Date(),
      });

    this.logger.log(
      {
        event: 'organization_subscription.mercado_pago_authorized_payment_reconciled',
        organizationId: result.organizationId,
        processed: result.processed,
        authorizedPaymentId: authorizedPayment.id,
        paymentStatus,
      },
      'OrganizationSubscriptionsService',
    );

    return { accepted: true };
  }

  private async buildResponse(
    organizationId: string,
  ): Promise<OrganizationSubscriptionResponseDto> {
    const [current, limits] = await Promise.all([
      this.organizationSubscriptionsRepository.findCurrent(organizationId),
      this.planLimitsService.getOrganizationLimitSnapshot(organizationId),
    ]);

    if (!current) {
      return {
        organizationId,
        status: null,
        isActive: false,
        hasActiveSubscription: false,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        plan: null,
        pendingPlan: null,
        checkoutUrl: null,
        gatewaySubscriptionId: null,
        pendingGatewaySubscriptionId: null,
        limits: null,
        usage: limits.usage,
      };
    }

    const pendingPlan = current.subscription.pendingPlanId
      ? await this.organizationSubscriptionsRepository.findPlanById(
          current.subscription.pendingPlanId,
        )
      : null;

    return this.toResponse(current, pendingPlan, limits.hasActiveSubscription, limits.usage);
  }

  private async buildPreparedResponse(
    organizationId: string,
    checkoutUrl: string,
  ): Promise<PreparedPlanChangeResponseDto> {
    const response = await this.buildResponse(organizationId);

    return {
      ...response,
      checkoutUrl,
    };
  }

  private toResponse(
    current: OrganizationSubscriptionWithPlan,
    pendingPlan: SubscriptionPlanRecord | null,
    hasActiveSubscription: boolean,
    usage: OrganizationSubscriptionResponseDto['usage'],
  ): OrganizationSubscriptionResponseDto {
    return {
      organizationId: current.subscription.organizationId,
      status: current.subscription.status,
      isActive: current.subscription.isActive,
      hasActiveSubscription,
      trialEndsAt: this.toIsoOrNull(current.subscription.trialEndsAt),
      currentPeriodStart: this.toIsoOrNull(current.subscription.currentPeriodStart),
      currentPeriodEnd: this.toIsoOrNull(current.subscription.currentPeriodEnd),
      plan: this.subscriptionPlansService.toPlanResponse(current.plan),
      pendingPlan: pendingPlan
        ? this.subscriptionPlansService.toPlanResponse(pendingPlan)
        : null,
      checkoutUrl: current.subscription.checkoutUrl ?? null,
      gatewaySubscriptionId: current.subscription.gatewaySubscriptionId ?? null,
      pendingGatewaySubscriptionId:
        current.subscription.pendingGatewaySubscriptionId ?? null,
      limits: this.subscriptionPlansService.toPlanResponse(current.plan).limits,
      usage,
    };
  }

  private async ensureTrialExists(
    session: AuthenticatedSession,
    organizationId: string,
  ): Promise<void> {
    const current =
      await this.organizationSubscriptionsRepository.findCurrent(organizationId);

    if (current) {
      return;
    }

    await this.applyTrial(session);
  }

  private async getScopedActor(
    session: AuthenticatedSession,
    organizationId: string,
  ): Promise<SubscriptionActorRecord> {
    const actor =
      await this.organizationSubscriptionsRepository.findActorMember(
        organizationId,
        session.user.id,
      );

    if (actor) {
      return actor;
    }

    this.logger.warn(
      {
        event: 'organization_subscription.scope_forbidden',
        organizationId,
        actorUserId: session.user.id,
      },
      'OrganizationSubscriptionsService',
    );

    throw new ForbiddenException({
      code: 'ORGANIZATION_SCOPE_FORBIDDEN',
      message: 'User is not a member of the active organization',
    });
  }

  private assertCanManageSubscription(
    actor: SubscriptionActorRecord,
    actorUserId: string,
    organizationId: string,
  ) {
    if (MEMBER_MANAGER_ROLES.has(actor.role)) {
      return;
    }

    this.logger.warn(
      {
        event: 'organization_subscription.manage_forbidden',
        organizationId,
        actorUserId,
        actorRole: actor.role,
      },
      'OrganizationSubscriptionsService',
    );

    throw new ForbiddenException({
      code: 'ORGANIZATION_SUBSCRIPTION_MANAGEMENT_FORBIDDEN',
      message: 'Only organization owners can manage subscriptions',
    });
  }

  private assertTrialCanBeReused(
    subscription: OrganizationSubscriptionRecord,
  ): void {
    if (subscription.status === 'trialing' && subscription.isActive) {
      return;
    }

    throw new ConflictException({
      code: 'ORGANIZATION_TRIAL_ALREADY_USED',
      message: 'Organization trial has already been used',
    });
  }

  private async createPreapprovalSafely(input: {
    organizationId: string;
    targetPlan: SubscriptionPlanRecord;
    payerEmail: string;
    externalReference: string;
  }) {
    try {
      return await this.mercadoPagoService.createPreapproval({
        reason: `Recruta ${input.targetPlan.name}`,
        payerEmail: input.payerEmail,
        externalReference: input.externalReference,
        amountInCents: input.targetPlan.priceInCents,
        currency: input.targetPlan.currency,
        idempotencyKey: input.externalReference,
      });
    } catch (error) {
      if (error instanceof MercadoPagoNotConfiguredError) {
        throw new ServiceUnavailableException({
          code: 'MERCADO_PAGO_NOT_CONFIGURED',
          message: 'Mercado Pago integration is not configured',
        });
      }

      if (error instanceof MercadoPagoRequestError) {
        this.logger.error(
          {
            event: 'organization_subscription.mercado_pago_request_failed',
            organizationId: input.organizationId,
            statusCode: error.statusCode,
          },
          error.stack,
          'OrganizationSubscriptionsService',
        );

        throw new BadGatewayException({
          code: 'MERCADO_PAGO_REQUEST_FAILED',
          message: 'Mercado Pago request failed',
        });
      }

      throw error;
    }
  }

  private async getAuthorizedPaymentSafely(authorizedPaymentId: string) {
    try {
      return await this.mercadoPagoService.getAuthorizedPayment(authorizedPaymentId);
    } catch (error) {
      if (error instanceof MercadoPagoNotConfiguredError) {
        throw new ServiceUnavailableException({
          code: 'MERCADO_PAGO_NOT_CONFIGURED',
          message: 'Mercado Pago integration is not configured',
        });
      }

      if (error instanceof MercadoPagoRequestError) {
        this.logger.error(
          {
            event: 'organization_subscription.mercado_pago_authorized_payment_fetch_failed',
            authorizedPaymentId,
            statusCode: error.statusCode,
          },
          error.stack,
          'OrganizationSubscriptionsService',
        );

        throw new BadGatewayException({
          code: 'MERCADO_PAGO_REQUEST_FAILED',
          message: 'Mercado Pago request failed',
        });
      }

      throw error;
    }
  }

  private mapAuthorizedPaymentStatus(
    status: string | null,
    statusDetail: string | null,
  ): 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled' {
    if (status === 'processed' && statusDetail !== 'refunded') {
      return 'paid';
    }

    if (status === 'refunded' || statusDetail === 'refunded') {
      return 'refunded';
    }

    if (status === 'canceled' || status === 'cancelled') {
      return 'canceled';
    }

    if (status === 'rejected' || status === 'failed') {
      return 'failed';
    }

    return 'pending';
  }

  private externalReference(
    organizationId: string,
    plan: SubscriptionPlanRecord,
  ) {
    return `org-sub:${organizationId}:${plan.slug}:${Date.now()}`;
  }

  private getActiveOrganizationId(session: AuthenticatedSession): string {
    if (!session.session.activeOrganizationId) {
      throw new BadRequestException({
        code: 'NO_ACTIVE_ORGANIZATION',
        message: 'No active organization selected',
      });
    }

    return session.session.activeOrganizationId;
  }

  private addDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
  }

  private toIsoOrNull(date?: Date | null) {
    return date ? date.toISOString() : null;
  }
}

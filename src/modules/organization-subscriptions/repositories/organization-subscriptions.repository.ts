import { Inject, Injectable } from '@nestjs/common';
import { and, eq, or } from 'drizzle-orm';
import { database } from '../../../config/database.config';
import { DRIZZLE } from '../../../database/drizzle/drizzle.module';
import {
  auditLog,
  inboxEvent,
  member,
  organizationSubscription,
  outboxEvent,
  payment,
  subscriptionPlan,
} from '../../../database/drizzle/schema';
import type { MemberRole } from '../../members/domain/member-role';
import type { CommercialPlanSlug } from '../../subscription-plans/domain/subscription-plan';
import { SUBSCRIPTION_EVENT_TYPES } from '../domain/subscription-events';

type Database = typeof database;

export type OrganizationSubscriptionRecord =
  typeof organizationSubscription.$inferSelect;
export type SubscriptionPlanRecord = typeof subscriptionPlan.$inferSelect;

export interface SubscriptionActorRecord {
  id: string;
  userId: string;
  role: MemberRole;
}

export interface OrganizationSubscriptionWithPlan {
  subscription: OrganizationSubscriptionRecord;
  plan: SubscriptionPlanRecord;
}

interface CreateTrialInput {
  organizationId: string;
  actorUserId: string;
  planId: string;
  trialEndsAt: Date;
  now: Date;
}

interface PreparePlanChangeInput {
  organizationId: string;
  actorUserId: string;
  pendingPlanId: string;
  pendingGatewaySubscriptionId: string;
  gatewayPlanId: string | null;
  checkoutUrl: string;
  externalReference: string;
}

interface ReconcileAuthorizedPaymentInput {
  eventId: string;
  eventType: string;
  action: string | null;
  authorizedPaymentId: string;
  paymentId: string | null;
  preapprovalId: string | null;
  amountInCents: number;
  currency: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled';
  rawStatus: string | null;
  rawStatusDetail: string | null;
  payload: Record<string, unknown>;
  processedAt: Date;
}

@Injectable()
export class OrganizationSubscriptionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findActorMember(
    organizationId: string,
    userId: string,
  ): Promise<SubscriptionActorRecord | null> {
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

  async findCurrent(
    organizationId: string,
  ): Promise<OrganizationSubscriptionWithPlan | null> {
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

  async findPlanById(planId: string): Promise<SubscriptionPlanRecord | null> {
    const [plan] = await this.db
      .select()
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.id, planId))
      .limit(1);

    return plan ?? null;
  }

  async findActivePlanBySlug(
    slug: CommercialPlanSlug,
  ): Promise<SubscriptionPlanRecord | null> {
    const [plan] = await this.db
      .select()
      .from(subscriptionPlan)
      .where(and(eq(subscriptionPlan.slug, slug), eq(subscriptionPlan.isActive, true)))
      .limit(1);

    return plan ?? null;
  }

  async createTrial(
    input: CreateTrialInput,
  ): Promise<OrganizationSubscriptionRecord> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(organizationSubscription)
        .where(eq(organizationSubscription.organizationId, input.organizationId))
        .limit(1)
        .for('update');

      if (existing) {
        return existing;
      }

      const [created] = await tx
        .insert(organizationSubscription)
        .values({
          organizationId: input.organizationId,
          planId: input.planId,
          status: 'trialing',
          isActive: true,
          trialEndsAt: input.trialEndsAt,
          currentPeriodStart: input.now,
          currentPeriodEnd: input.trialEndsAt,
        })
        .returning();

      await tx.insert(auditLog).values({
        organizationId: input.organizationId,
        userId: input.actorUserId,
        action: SUBSCRIPTION_EVENT_TYPES.trialStarted,
        entityType: 'organization_subscription',
        entityId: input.organizationId,
      });

      await tx.insert(outboxEvent).values({
        eventType: SUBSCRIPTION_EVENT_TYPES.trialStarted,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entityType: 'organization_subscription',
        entityId: input.organizationId,
        payload: {
          planId: input.planId,
          trialEndsAt: input.trialEndsAt.toISOString(),
        },
      });

      return created;
    });
  }

  async preparePlanChange(
    input: PreparePlanChangeInput,
  ): Promise<OrganizationSubscriptionRecord | null> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(organizationSubscription)
        .set({
          pendingPlanId: input.pendingPlanId,
          pendingGatewaySubscriptionId: input.pendingGatewaySubscriptionId,
          gatewayPlanId: input.gatewayPlanId,
          checkoutUrl: input.checkoutUrl,
          externalReference: input.externalReference,
        })
        .where(eq(organizationSubscription.organizationId, input.organizationId))
        .returning();

      if (!updated) {
        return null;
      }

      await tx.insert(auditLog).values({
        organizationId: input.organizationId,
        userId: input.actorUserId,
        action: SUBSCRIPTION_EVENT_TYPES.planChangePrepared,
        entityType: 'organization_subscription',
        entityId: input.organizationId,
      });

      await tx.insert(outboxEvent).values({
        eventType: SUBSCRIPTION_EVENT_TYPES.planChangePrepared,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        entityType: 'organization_subscription',
        entityId: input.organizationId,
        payload: {
          pendingPlanId: input.pendingPlanId,
          pendingGatewaySubscriptionId: input.pendingGatewaySubscriptionId,
          externalReference: input.externalReference,
        },
      });

      return updated;
    });
  }

  async reconcileAuthorizedPayment(
    input: ReconcileAuthorizedPaymentInput,
  ): Promise<{ processed: boolean; organizationId: string | null }> {
    return this.db.transaction(async (tx) => {
      await tx
        .insert(inboxEvent)
        .values({
          eventId: input.eventId,
          eventType: input.eventType,
          source: 'mercadopago',
          payload: input.payload,
          metadata: {
            action: input.action,
            authorizedPaymentId: input.authorizedPaymentId,
            preapprovalId: input.preapprovalId,
          },
          status: 'processed',
          processedAt: input.processedAt,
        })
        .onConflictDoNothing({
          target: [inboxEvent.source, inboxEvent.eventId],
        });

      if (!input.preapprovalId) {
        return { processed: false, organizationId: null };
      }

      const [current] = await tx
        .select()
        .from(organizationSubscription)
        .where(
          or(
            eq(organizationSubscription.gatewaySubscriptionId, input.preapprovalId),
            eq(
              organizationSubscription.pendingGatewaySubscriptionId,
              input.preapprovalId,
            ),
          ),
        )
        .limit(1)
        .for('update');

      if (!current) {
        return { processed: false, organizationId: null };
      }

      const effectivePlanId = current.pendingPlanId ?? current.planId;
      const [effectivePlan] = await tx
        .select()
        .from(subscriptionPlan)
        .where(eq(subscriptionPlan.id, effectivePlanId))
        .limit(1);

      if (input.paymentStatus === 'paid') {
        await tx
          .update(organizationSubscription)
          .set({
            planId: effectivePlanId,
            pendingPlanId: null,
            status: 'active',
            isActive: true,
            activatedAt: current.activatedAt ?? input.processedAt,
            gatewaySubscriptionId: input.preapprovalId,
            pendingGatewaySubscriptionId: null,
            currentPeriodStart: input.processedAt,
            currentPeriodEnd: this.addMonths(
              input.processedAt,
              effectivePlan?.billingPeriodMonths ?? 1,
            ),
          })
          .where(
            eq(
              organizationSubscription.organizationId,
              current.organizationId,
            ),
          );
      } else if (input.paymentStatus === 'canceled') {
        await tx
          .update(organizationSubscription)
          .set({
            status: 'canceled',
            isActive: false,
            canceledAt: input.processedAt,
          })
          .where(
            eq(
              organizationSubscription.organizationId,
              current.organizationId,
            ),
          );
      } else if (input.paymentStatus === 'failed') {
        await tx
          .update(organizationSubscription)
          .set({
            status: 'past_due',
          })
          .where(
            eq(
              organizationSubscription.organizationId,
              current.organizationId,
            ),
          );
      }

      const paymentValues = {
        organizationId: current.organizationId,
        amountInCents: input.amountInCents,
        currency: input.currency,
        gateway: 'mercadopago' as const,
        status: input.paymentStatus,
        gatewayPaymentId: input.paymentId,
        gatewaySubscriptionId: input.preapprovalId,
        gatewayPlanId: current.gatewayPlanId,
        gatewayNotificationId: input.eventId,
        externalReference: current.externalReference,
        rawStatus: input.rawStatus,
        rawStatusDetail: input.rawStatusDetail,
        payload: input.payload,
        paidAt: input.paymentStatus === 'paid' ? input.processedAt : null,
      };
      const paymentUpdate = {
        amountInCents: input.amountInCents,
        currency: input.currency,
        status: input.paymentStatus,
        gatewaySubscriptionId: input.preapprovalId,
        gatewayPlanId: current.gatewayPlanId,
        gatewayNotificationId: input.eventId,
        externalReference: current.externalReference,
        rawStatus: input.rawStatus,
        rawStatusDetail: input.rawStatusDetail,
        payload: input.payload,
        paidAt: input.paymentStatus === 'paid' ? input.processedAt : null,
        updatedAt: input.processedAt,
      };

      if (input.paymentId) {
        await tx
          .insert(payment)
          .values(paymentValues)
          .onConflictDoUpdate({
            target: [payment.gateway, payment.gatewayPaymentId],
            set: paymentUpdate,
          });
      } else {
        await tx
          .insert(payment)
          .values(paymentValues)
          .onConflictDoUpdate({
            target: [payment.gateway, payment.gatewayNotificationId],
            set: paymentUpdate,
          });
      }

      return { processed: true, organizationId: current.organizationId };
    });
  }

  private addMonths(date: Date, months: number) {
    const nextDate = new Date(date);
    nextDate.setUTCMonth(nextDate.getUTCMonth() + months);
    return nextDate;
  }
}

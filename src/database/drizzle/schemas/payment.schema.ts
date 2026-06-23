import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { paymentGatewayEnum } from '../enums/payment-gateway.enum';
import { paymentStatusEnum } from '../enums/payment-status.enum';
import {
  createdAt,
  timestampUtc,
  updatedAt,
  uuidv7PrimaryKey,
} from '../schema-helpers';
import { organization } from './auth.schema';

type PaymentGatewayPayload = Record<string, unknown>;

export const payment = pgTable(
  'payment',
  {
    id: uuidv7PrimaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    amountInCents: integer('amount_in_cents').notNull(),
    currency: text('currency').default('BRL').notNull(),
    gateway: paymentGatewayEnum('gateway').notNull(),
    status: paymentStatusEnum('status').default('pending').notNull(),
    gatewayPaymentId: text('gateway_payment_id'),
    gatewaySubscriptionId: text('gateway_subscription_id'),
    gatewayPlanId: text('gateway_plan_id'),
    gatewayNotificationId: text('gateway_notification_id'),
    externalReference: text('external_reference'),
    rawStatus: text('raw_status'),
    rawStatusDetail: text('raw_status_detail'),
    payload: jsonb('payload').$type<PaymentGatewayPayload>(),
    paidAt: timestampUtc('paid_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('payment_organization_id_idx').on(table.organizationId),
    index('payment_status_idx').on(table.status),
    index('payment_gateway_subscription_idx').on(table.gatewaySubscriptionId),
    index('payment_external_reference_idx').on(table.externalReference),
    uniqueIndex('payment_gateway_payment_uidx').on(
      table.gateway,
      table.gatewayPaymentId,
    ),
    uniqueIndex('payment_gateway_notification_uidx').on(
      table.gateway,
      table.gatewayNotificationId,
    ),
  ],
);

import {
  index,
  integer,
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
    paidAt: timestampUtc('paid_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('payment_organization_id_idx').on(table.organizationId),
    index('payment_status_idx').on(table.status),
    uniqueIndex('payment_gateway_payment_uidx').on(
      table.gateway,
      table.gatewayPaymentId,
    ),
  ],
);

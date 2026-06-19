import { pgEnum } from 'drizzle-orm/pg-core';

export const paymentGatewayEnum = pgEnum('payment_gateway', [
  'mercadopago',
  'stripe',
  'asaas',
  'iugu',
  'manual',
]);

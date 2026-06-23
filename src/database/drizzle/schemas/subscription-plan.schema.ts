import {
  boolean,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { planEnum } from '../enums/plan.enum';
import { createdAt, updatedAt, uuidv7PrimaryKey } from '../schema-helpers';

export const subscriptionPlan = pgTable(
  'subscription_plan',
  {
    id: uuidv7PrimaryKey(),
    name: text('name').notNull(),
    slug: planEnum('slug').notNull(),
    description: text('description'),
    priceInCents: integer('price_in_cents').notNull(),
    currency: text('currency').default('BRL').notNull(),
    billingPeriodMonths: integer('billing_period_months').default(1).notNull(),
    trialDays: integer('trial_days').default(14).notNull(),
    maxUsers: integer('max_users').notNull(),
    maxJobs: integer('max_jobs').notNull(),
    monthlyAiTokens: integer('monthly_ai_tokens').notNull(),
    maxCandidatesPerMonth: integer('max_candidates_per_month').notNull(),
    customCareerPage: boolean('custom_career_page').default(false).notNull(),
    apiAccess: boolean('api_access').default(false).notNull(),
    prioritySupport: boolean('priority_support').default(false).notNull(),
    gatewayPlanId: text('gateway_plan_id'),
    pricingJustification: text('pricing_justification'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('subscription_plan_slug_uidx').on(table.slug),
    uniqueIndex('subscription_plan_gateway_plan_uidx').on(table.gatewayPlanId),
  ],
);

import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { invitationStatusEnum } from '../enums/invitation-status.enum';
import { organizationRoleEnum } from '../enums/organization-role.enum';
import { subscriptionStatusEnum } from '../enums/subscription-status.enum';
import {
  createdAt,
  timestampUtc,
  updatedAt,
  uuidv7PrimaryKey,
} from '../schema-helpers';
import { subscriptionPlan } from './subscription-plan.schema';

export const user = pgTable('user', {
  id: uuidv7PrimaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  'session',
  {
    id: uuidv7PrimaryKey(),
    expiresAt: timestampUtc('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    activeOrganizationId: uuid('active_organization_id').references(
      () => organization.id,
      { onDelete: 'set null' },
    ),
  },
  (table) => [
    index('session_user_id_idx').on(table.userId),
    index('session_active_organization_id_idx').on(table.activeOrganizationId),
  ],
);

export const account = pgTable(
  'account',
  {
    id: uuidv7PrimaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestampUtc('access_token_expires_at'),
    refreshTokenExpiresAt: timestampUtc('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('account_user_id_idx').on(table.userId),
    uniqueIndex('account_provider_account_uidx').on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const verification = pgTable(
  'verification',
  {
    id: uuidv7PrimaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestampUtc('expires_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const organization = pgTable(
  'organization',
  {
    id: uuidv7PrimaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    logo: text('logo'),
    metadata: text('metadata'),
    createdAt: createdAt(),
    createdBy: uuid('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [uniqueIndex('organization_slug_uidx').on(table.slug)],
);

export const organizationProfile = pgTable(
  'organization_profile',
  {
    organizationId: uuid('organization_id')
      .primaryKey()
      .references(() => organization.id, { onDelete: 'cascade' }),
    legalName: text('legal_name'),
    tradeName: text('trade_name'),
    cnpj: text('cnpj'),
    website: text('website'),
    linkedinUrl: text('linkedin_url'),
    careersPageUrl: text('careers_page_url'),
    industry: text('industry'),
    employeeCount: integer('employee_count'),
    phone: text('phone'),
    country: text('country'),
    state: text('state'),
    city: text('city'),
    description: text('description'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('organization_profile_cnpj_uidx').on(table.cnpj)],
);

export const organizationAiUsage = pgTable(
  'organization_ai_usage',
  {
    id: uuidv7PrimaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    promptTokens: integer('prompt_tokens').default(0).notNull(),
    completionTokens: integer('completion_tokens').default(0).notNull(),
    embeddingTokens: integer('embedding_tokens').default(0).notNull(),
    cachedTokens: integer('cached_tokens').default(0).notNull(),
    requestsCount: integer('requests_count').default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('organization_ai_usage_period_uidx').on(
      table.organizationId,
      table.year,
      table.month,
    ),
  ],
);

export const organizationSubscription = pgTable(
  'organization_subscription',
  {
    organizationId: uuid('organization_id')
      .primaryKey()
      .references(() => organization.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => subscriptionPlan.id),
    status: subscriptionStatusEnum('status').default('trialing').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    trialEndsAt: timestampUtc('trial_ends_at'),
    currentPeriodStart: timestampUtc('current_period_start'),
    currentPeriodEnd: timestampUtc('current_period_end'),
    gatewayCustomerId: text('gateway_customer_id'),
    gatewaySubscriptionId: text('gateway_subscription_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('organization_subscription_gateway_customer_uidx').on(
      table.gatewayCustomerId,
    ),
    uniqueIndex('organization_subscription_gateway_subscription_uidx').on(
      table.gatewaySubscriptionId,
    ),
  ],
);

export const member = pgTable(
  'member',
  {
    id: uuidv7PrimaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: organizationRoleEnum('role').default('recruiter').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('member_organization_id_idx').on(table.organizationId),
    index('member_user_id_idx').on(table.userId),
    uniqueIndex('member_org_user_uidx').on(table.organizationId, table.userId),
  ],
);

export const invitation = pgTable(
  'invitation',
  {
    id: uuidv7PrimaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: organizationRoleEnum('role').default('recruiter').notNull(),
    status: invitationStatusEnum('status').default('pending').notNull(),
    expiresAt: timestampUtc('expires_at').notNull(),
    createdAt: createdAt(),
    inviterId: uuid('inviter_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('invitation_organization_id_idx').on(table.organizationId),
    index('invitation_org_email_idx').on(table.organizationId, table.email),
    index('invitation_status_idx').on(table.status),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
  invitations: many(invitation),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
  activeOrganization: one(organization, {
    fields: [session.activeOrganizationId],
    references: [organization.id],
  }),
}));

export const organizationProfileRelations = relations(
  organizationProfile,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationProfile.organizationId],
      references: [organization.id],
    }),
  }),
);

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const organizationRelations = relations(
  organization,
  ({ many, one }) => ({
    createdByUser: one(user, {
      fields: [organization.createdBy],
      references: [user.id],
    }),
    profile: one(organizationProfile),
    subscription: one(organizationSubscription),
    members: many(member),
    invitations: many(invitation),
  }),
);

export const organizationSubscriptionRelations = relations(
  organizationSubscription,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationSubscription.organizationId],
      references: [organization.id],
    }),
    plan: one(subscriptionPlan, {
      fields: [organizationSubscription.planId],
      references: [subscriptionPlan.id],
    }),
  }),
);

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

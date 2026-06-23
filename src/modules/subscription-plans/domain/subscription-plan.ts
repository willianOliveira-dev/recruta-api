export const COMMERCIAL_PLAN_SLUGS = ['basic', 'plus', 'pro'] as const;

export type CommercialPlanSlug = (typeof COMMERCIAL_PLAN_SLUGS)[number];

export const ACTIVE_SUBSCRIPTION_STATUSES = ['trialing', 'active'] as const;

export const isCommercialPlanSlug = (
  value: string,
): value is CommercialPlanSlug =>
  COMMERCIAL_PLAN_SLUGS.includes(value as CommercialPlanSlug);


export const INVITATION_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'canceled',
  'expired',
] as const;

export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const normalizeInvitationEmail = (email: string) =>
  email.trim().toLowerCase();

export const createInvitationExpiration = (now = new Date()) =>
  new Date(now.getTime() + INVITATION_TTL_MS);

export const isInvitationExpired = (expiresAt: Date, now = new Date()) =>
  expiresAt.getTime() <= now.getTime();

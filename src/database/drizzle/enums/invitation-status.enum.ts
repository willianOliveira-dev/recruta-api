import { pgEnum } from 'drizzle-orm/pg-core';

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'rejected',
  'canceled',
  'expired',
]);

import { pgEnum } from 'drizzle-orm/pg-core';

export const organizationRoleEnum = pgEnum('organization_role', [
  'owner',
  'admin',
  'member',
  'recruiter',
]);

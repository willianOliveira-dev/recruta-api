import type { MemberRole } from '../../members/domain/member-role';

export const APPLICATION_MANAGER_ROLES = new Set<MemberRole>([
  'owner',
  'recruiter',
]);

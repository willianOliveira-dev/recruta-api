import type { MemberRole } from '../../members/domain/member-role';

export const INTERVIEW_NOTE_MANAGER_ROLES = new Set<MemberRole>([
  'owner',
  'recruiter',
]);

export const MEMBER_ROLES = ['owner', 'admin', 'member', 'recruiter'] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_MANAGER_ROLES = new Set<MemberRole>(['owner']);

export const isOwnerRole = (role: MemberRole) => role === 'owner';

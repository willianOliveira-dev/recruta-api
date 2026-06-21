export const INVITATION_EVENT_TYPES = {
  invited: 'member.invited',
  resent: 'member.invitation.resent',
  canceled: 'member.invitation.canceled',
  accepted: 'member.invitation.accepted',
} as const;

export type InvitationEventType =
  (typeof INVITATION_EVENT_TYPES)[keyof typeof INVITATION_EVENT_TYPES];

export class PendingInvitationAlreadyExistsError extends Error {
  constructor() {
    super('Pending invitation already exists');
    this.name = 'PendingInvitationAlreadyExistsError';
  }
}

export class InvitationMemberAlreadyExistsError extends Error {
  constructor() {
    super('User is already an organization member');
    this.name = 'InvitationMemberAlreadyExistsError';
  }
}

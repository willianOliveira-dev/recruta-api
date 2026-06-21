export class LastOrganizationOwnerError extends Error {
  constructor() {
    super('Cannot remove the last organization owner');
    this.name = 'LastOrganizationOwnerError';
  }
}

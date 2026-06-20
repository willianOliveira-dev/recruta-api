export class OrganizationSlug {
  private constructor(private readonly value: string) {}

  static fromName(name: string): OrganizationSlug {
    const slug = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

    return new OrganizationSlug(slug || 'organization');
  }

  static fromValue(value: string): OrganizationSlug {
    return OrganizationSlug.fromName(value);
  }

  withSuffix(suffix: string): OrganizationSlug {
    return new OrganizationSlug(`${this.value}-${suffix}`);
  }

  toString(): string {
    return this.value;
  }
}

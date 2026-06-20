import { OrganizationSlug } from '../domain/organization-slug';

describe('OrganizationSlug', () => {
  it('normalizes organization names for stable ATS tenant URLs', () => {
    const slug = OrganizationSlug.fromName('Recrutamento & Seleção São Paulo');

    expect(slug.toString()).toBe('recrutamento-selecao-sao-paulo');
  });

  it('uses a safe fallback when the name has no sluggable characters', () => {
    const slug = OrganizationSlug.fromName('!!!');

    expect(slug.toString()).toBe('organization');
  });
});

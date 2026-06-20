import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { OrganizationProfileDto } from '../dto/organization-profile.dto';

const validateProfile = (input: Record<string, unknown>) => {
  const dto = plainToInstance(OrganizationProfileDto, input);

  return {
    dto,
    errors: validateSync(dto),
  };
};

describe('OrganizationProfileDto', () => {
  it('normalizes and accepts valid Brazilian CNPJ and postal code values', () => {
    const { dto, errors } = validateProfile({
      cnpj: '11.222.333/0001-81',
      postalCode: '01001-000',
      website: 'https://recruta.example.com',
      linkedinUrl: 'https://linkedin.com/company/recruta',
      careersPageUrl: 'https://recruta.example.com/careers',
    });

    expect(errors).toHaveLength(0);
    expect(dto.cnpj).toBe('11222333000181');
    expect(dto.postalCode).toBe('01001000');
  });

  it('rejects invalid Brazilian CNPJ and postal code values', () => {
    const { errors } = validateProfile({
      cnpj: '11.111.111/1111-11',
      postalCode: '01001',
    });

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['cnpj', 'postalCode']),
    );
  });

  it('keeps organization URLs validated by class-validator', () => {
    const { errors } = validateProfile({
      website: 'not-a-url',
      linkedinUrl: 'linkedin',
      careersPageUrl: '/careers',
    });

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['website', 'linkedinUrl', 'careersPageUrl']),
    );
  });
});

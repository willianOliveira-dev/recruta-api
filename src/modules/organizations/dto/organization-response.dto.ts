import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrganizationProfileResponseDto {
  @ApiPropertyOptional({ example: 'Recruta Tecnologia LTDA' })
  legalName?: string | null;

  @ApiPropertyOptional({ example: 'Recruta' })
  tradeName?: string | null;

  @ApiPropertyOptional({ example: '12345678000199' })
  cnpj?: string | null;

  @ApiPropertyOptional({ example: 'https://recruta.example.com' })
  website?: string | null;

  @ApiPropertyOptional({ example: 'https://linkedin.com/company/recruta' })
  linkedinUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://recruta.example.com/careers' })
  careersPageUrl?: string | null;

  @ApiPropertyOptional({ example: 'HR Tech' })
  industry?: string | null;

  @ApiPropertyOptional({ example: 120 })
  employeeCount?: number | null;

  @ApiPropertyOptional({ example: '+55 11 99999-9999' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'BR' })
  country?: string | null;

  @ApiPropertyOptional({ example: 'SP' })
  state?: string | null;

  @ApiPropertyOptional({ example: 'Sao Paulo' })
  city?: string | null;

  @ApiPropertyOptional({ example: 'Rua das ATS' })
  street?: string | null;

  @ApiPropertyOptional({ example: 'Centro' })
  district?: string | null;

  @ApiPropertyOptional({ example: '01001-000' })
  postalCode?: string | null;

  @ApiPropertyOptional({
    example: 'Plataforma de recrutamento com foco em triagem inteligente.',
  })
  description?: string | null;
}

export class OrganizationResponseDto {
  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d88de' })
  id: string;

  @ApiProperty({ example: 'Recruta Tecnologia' })
  name: string;

  @ApiProperty({ example: 'recruta-tecnologia' })
  slug: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  logo?: string | null;

  @ApiProperty({ example: 'owner' })
  role: string;

  @ApiPropertyOptional({ type: OrganizationProfileResponseDto })
  profile?: OrganizationProfileResponseDto | null;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { normalizeCnpj } from '../domain/brazilian-company-document';
import { normalizePostalCode } from '../domain/brazilian-postal-code';
import { IsBrazilianCnpj } from '../decorators/is-brazilian-cnpj.decorator';
import { IsBrazilianPostalCode } from '../decorators/is-brazilian-postal-code.decorator';

const normalizeStringValue = (
  value: unknown,
  normalize: (value: string) => string,
): unknown => (typeof value === 'string' ? normalize(value) : value);

export class OrganizationProfileDto {
  @ApiPropertyOptional({ example: 'Recruta Tecnologia LTDA' })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ example: 'Recruta' })
  @IsOptional()
  @IsString()
  tradeName?: string;

  @ApiPropertyOptional({ example: '12345678000199' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => normalizeStringValue(value, normalizeCnpj))
  @IsBrazilianCnpj()
  cnpj?: string;

  @ApiPropertyOptional({ example: 'https://recruta.example.com' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/company/recruta' })
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @ApiPropertyOptional({ example: 'https://recruta.example.com/careers' })
  @IsOptional()
  @IsUrl()
  careersPageUrl?: string;

  @ApiPropertyOptional({ example: 'HR Tech' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(1)
  employeeCount?: number;

  @ApiPropertyOptional({ example: '+55 11 99999-9999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'BR' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'Sao Paulo' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Rua das ATS' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  street?: string;

  @ApiPropertyOptional({ example: 'Centro' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @ApiPropertyOptional({ example: '01001-000' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => normalizeStringValue(value, normalizePostalCode))
  @IsBrazilianPostalCode()
  postalCode?: string;

  @ApiPropertyOptional({
    example: 'Plataforma de recrutamento com foco em triagem inteligente.',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

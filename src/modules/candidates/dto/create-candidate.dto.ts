import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { SENIORITY_LEVELS } from '../../jobs/dto/create-job.dto';

export const WORK_MODE_PREFERENCES = [
  'remote',
  'hybrid',
  'onsite',
  'flexible',
] as const;

export const AVAILABILITY_TYPES = [
  'immediate',
  'one_week',
  'two_weeks',
  'one_month',
  'more_than_one_month',
  'unavailable',
] as const;

export class CreateCandidateDto {
  @ApiProperty({ example: 'Ana Souza' })
  @IsString()
  @MaxLength(160)
  fullName: string;

  @ApiProperty({ example: 'ana.souza@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ example: '+55 11 99999-9999' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: '12345678909' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  documentCpf?: string;

  @ApiPropertyOptional({ example: '1995-03-18' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 'Sao Paulo' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional({ example: 'BR' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ example: 'https://www.linkedin.com/in/anasouza' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  linkedinUrl?: string;

  @ApiPropertyOptional({ example: 'https://github.com/anasouza' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  githubUrl?: string;

  @ApiPropertyOptional({ example: 'https://anasouza.dev' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  portfolioUrl?: string;

  @ApiPropertyOptional({ example: 'https://storage.example.com/resume.pdf' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(1000)
  resumeUrl?: string;

  @ApiPropertyOptional({
    example: 'Resumo profissional extraido do curriculo.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  resumeText?: string;

  @ApiPropertyOptional({ enum: WORK_MODE_PREFERENCES, example: 'remote' })
  @IsOptional()
  @IsIn(WORK_MODE_PREFERENCES)
  workModePreference?: (typeof WORK_MODE_PREFERENCES)[number];

  @ApiPropertyOptional({ enum: AVAILABILITY_TYPES, example: 'immediate' })
  @IsOptional()
  @IsIn(AVAILABILITY_TYPES)
  availability?: (typeof AVAILABILITY_TYPES)[number];

  @ApiPropertyOptional({ example: 1500000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryExpectation?: number;

  @ApiPropertyOptional({ example: 'BRL' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  salaryCurrency?: string;

  @ApiPropertyOptional({ enum: SENIORITY_LEVELS, example: 'senior' })
  @IsOptional()
  @IsIn(SENIORITY_LEVELS)
  seniority?: (typeof SENIORITY_LEVELS)[number];

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @Min(0)
  yearsOfExperience?: number;

  @ApiPropertyOptional({ example: 'Bachelor Computer Science' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  educationDegree?: string;

  @ApiPropertyOptional({ example: 'USP' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  educationInstitution?: string;

  @ApiPropertyOptional({ example: 2018 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  educationYear?: number;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const SENIORITY_LEVELS = [
  'internship',
  'junior',
  'mid_level',
  'senior',
  'specialist',
  'lead',
  'manager',
] as const;

export const WORK_MODES = ['remote', 'hybrid', 'onsite'] as const;

export const CONTRACT_TYPES = [
  'clt',
  'pj',
  'internship',
  'temporary',
  'freelance',
] as const;

export class CreateJobDto {
  @ApiProperty({ example: 'Backend Engineer' })
  @IsString()
  @MaxLength(160)
  title: string;

  @ApiProperty({ example: 'Engineering' })
  @IsString()
  @MaxLength(120)
  area: string;

  @ApiPropertyOptional({ example: 'Platform' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @ApiProperty({ enum: SENIORITY_LEVELS, example: 'senior' })
  @IsIn(SENIORITY_LEVELS)
  seniority: (typeof SENIORITY_LEVELS)[number];

  @ApiProperty({ enum: WORK_MODES, example: 'remote' })
  @IsIn(WORK_MODES)
  workMode: (typeof WORK_MODES)[number];

  @ApiPropertyOptional({ example: 'Sao Paulo' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationCity?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  locationState?: string;

  @ApiPropertyOptional({ example: 'BR' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  locationCountry?: string;

  @ApiProperty({ enum: CONTRACT_TYPES, example: 'clt' })
  @IsIn(CONTRACT_TYPES)
  contractType: (typeof CONTRACT_TYPES)[number];

  @ApiPropertyOptional({ example: 1200000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({ example: 1800000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional({ example: 'BRL' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  salaryCurrency?: string;

  @ApiPropertyOptional({ example: 'Build scalable ATS services.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @ApiPropertyOptional({ example: 'Own APIs, observability and integrations.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  responsibilities?: string;

  @ApiPropertyOptional({ example: 'NestJS, PostgreSQL and queue experience.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  requirements?: string;

  @ApiPropertyOptional({ example: 'Experience with pgvector.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  niceToHave?: string;

  @ApiPropertyOptional({ example: 'Health plan and remote work.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  benefits?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  vacanciesCount?: number;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  appliesUntil?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxApplicants?: number;
}

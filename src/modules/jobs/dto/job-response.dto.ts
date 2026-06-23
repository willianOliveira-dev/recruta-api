import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CONTRACT_TYPES, SENIORITY_LEVELS, WORK_MODES } from './create-job.dto';

export class JobSkillResponseDto {
  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d9001' })
  id: string;

  @ApiProperty({ example: 'TypeScript' })
  skill: string;

  @ApiProperty({ example: true })
  required: boolean;
}

export class JobResponseDto {
  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d9000' })
  id: string;

  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d88e0' })
  organizationId: string;

  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d88de' })
  recruiterId: string;

  @ApiProperty({ example: 'Backend Engineer' })
  title: string;

  @ApiProperty({ example: 'Engineering' })
  area: string;

  @ApiPropertyOptional({ example: 'Platform', nullable: true })
  department: string | null;

  @ApiProperty({ enum: SENIORITY_LEVELS, example: 'senior' })
  seniority: string;

  @ApiProperty({ enum: WORK_MODES, example: 'remote' })
  workMode: string;

  @ApiPropertyOptional({ example: 'Sao Paulo', nullable: true })
  locationCity: string | null;

  @ApiPropertyOptional({ example: 'SP', nullable: true })
  locationState: string | null;

  @ApiPropertyOptional({ example: 'BR', nullable: true })
  locationCountry: string | null;

  @ApiProperty({ enum: CONTRACT_TYPES, example: 'clt' })
  contractType: string;

  @ApiPropertyOptional({ example: 1200000, nullable: true })
  salaryMin: number | null;

  @ApiPropertyOptional({ example: 1800000, nullable: true })
  salaryMax: number | null;

  @ApiProperty({ example: 'BRL' })
  salaryCurrency: string;

  @ApiPropertyOptional({ nullable: true })
  summary: string | null;

  @ApiPropertyOptional({ nullable: true })
  responsibilities: string | null;

  @ApiPropertyOptional({ nullable: true })
  requirements: string | null;

  @ApiPropertyOptional({ nullable: true })
  niceToHave: string | null;

  @ApiPropertyOptional({ nullable: true })
  benefits: string | null;

  @ApiProperty({ example: 1 })
  vacanciesCount: number;

  @ApiPropertyOptional({ nullable: true })
  appliesUntil: string | null;

  @ApiPropertyOptional({ example: 500, nullable: true })
  maxApplicants: number | null;

  @ApiProperty({ example: 'draft' })
  status: string;

  @ApiProperty({ type: [JobSkillResponseDto] })
  skills: JobSkillResponseDto[];

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

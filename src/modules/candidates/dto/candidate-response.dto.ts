import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AVAILABILITY_TYPES,
  WORK_MODE_PREFERENCES,
} from './create-candidate.dto';
import { SENIORITY_LEVELS } from '../../jobs/dto/create-job.dto';

export class CandidateSkillResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  skill: string;

  @ApiPropertyOptional({ nullable: true })
  years: number | null;
}

export class CandidateExperienceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  company: string;

  @ApiProperty()
  role: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  startedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  endedAt: string | null;

  @ApiProperty()
  isCurrent: boolean;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class CandidateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  documentCpf: string | null;

  @ApiPropertyOptional({ nullable: true })
  birthDate: string | null;

  @ApiPropertyOptional({ nullable: true })
  city: string | null;

  @ApiPropertyOptional({ nullable: true })
  state: string | null;

  @ApiPropertyOptional({ nullable: true })
  country: string | null;

  @ApiPropertyOptional({ nullable: true })
  linkedinUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  githubUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  portfolioUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  resumeUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  resumeText: string | null;

  @ApiPropertyOptional({ enum: WORK_MODE_PREFERENCES, nullable: true })
  workModePreference: (typeof WORK_MODE_PREFERENCES)[number] | null;

  @ApiPropertyOptional({ enum: AVAILABILITY_TYPES, nullable: true })
  availability: (typeof AVAILABILITY_TYPES)[number] | null;

  @ApiPropertyOptional({ nullable: true })
  salaryExpectation: number | null;

  @ApiProperty()
  salaryCurrency: string;

  @ApiPropertyOptional({ enum: SENIORITY_LEVELS, nullable: true })
  seniority: (typeof SENIORITY_LEVELS)[number] | null;

  @ApiPropertyOptional({ nullable: true })
  yearsOfExperience: number | null;

  @ApiPropertyOptional({ nullable: true })
  educationDegree: string | null;

  @ApiPropertyOptional({ nullable: true })
  educationInstitution: string | null;

  @ApiPropertyOptional({ nullable: true })
  educationYear: number | null;

  @ApiProperty({ type: [CandidateSkillResponseDto] })
  skills: CandidateSkillResponseDto[];

  @ApiProperty({ type: [CandidateExperienceResponseDto] })
  experiences: CandidateExperienceResponseDto[];

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

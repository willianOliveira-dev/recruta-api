import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CandidateExperienceInputDto {
  @ApiProperty({ example: 'Acme Tecnologia' })
  @IsString()
  @MaxLength(160)
  company: string;

  @ApiProperty({ example: 'Backend Engineer' })
  @IsString()
  @MaxLength(160)
  role: string;

  @ApiPropertyOptional({ example: 'Built recruitment APIs and integrations.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ example: '2021-01-01' })
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

export class ReplaceCandidateExperiencesDto {
  @ApiProperty({ type: [CandidateExperienceInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CandidateExperienceInputDto)
  experiences: CandidateExperienceInputDto[];
}

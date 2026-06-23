import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CandidateSkillInputDto {
  @ApiProperty({ example: 'NestJS' })
  @IsString()
  @MaxLength(80)
  skill: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(0)
  years?: number;
}

export class ReplaceCandidateSkillsDto {
  @ApiProperty({ type: [CandidateSkillInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CandidateSkillInputDto)
  skills: CandidateSkillInputDto[];
}

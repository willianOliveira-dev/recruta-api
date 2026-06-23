import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class JobSkillInputDto {
  @ApiProperty({ example: 'TypeScript' })
  @IsString()
  @MaxLength(80)
  skill: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class ReplaceJobSkillsDto {
  @ApiProperty({ type: [JobSkillInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobSkillInputDto)
  skills: JobSkillInputDto[];
}

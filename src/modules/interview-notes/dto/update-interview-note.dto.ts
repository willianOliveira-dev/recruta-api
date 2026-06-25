import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateInterviewNoteDto {
  @ApiPropertyOptional({
    example:
      'Candidate clarified project scope and references during second call.',
    maxLength: 4000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 5, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;

  @ApiPropertyOptional({
    example: true,
    description:
      'Marks this note as evidence that can be sent to async AI context.',
  })
  @IsOptional()
  @IsBoolean()
  includeInAiContext?: boolean;
}

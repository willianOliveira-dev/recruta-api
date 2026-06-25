import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateInterviewNoteDto {
  @ApiProperty({
    example:
      'Candidate gave strong STAR evidence for backend incident response.',
    maxLength: 4000,
  })
  @IsString()
  @MaxLength(4000)
  content: string;

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description:
      'Marks this note as evidence that can be sent to async AI context.',
  })
  @IsOptional()
  @IsBoolean()
  includeInAiContext?: boolean;
}

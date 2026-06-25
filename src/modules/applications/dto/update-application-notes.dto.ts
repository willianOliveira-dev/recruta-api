import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateApplicationNotesDto {
  @ApiPropertyOptional({
    example: 'Candidate has strong backend evidence, verify salary range.',
    nullable: true,
    maxLength: 4000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

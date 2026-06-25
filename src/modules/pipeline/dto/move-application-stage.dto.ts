import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  APPLICATION_STAGES,
  type ApplicationStage,
} from '../../applications/domain/application-stage';

export class MoveApplicationStageDto {
  @ApiProperty({ enum: APPLICATION_STAGES, example: 'screening' })
  @IsIn(APPLICATION_STAGES)
  stage: ApplicationStage;

  @ApiPropertyOptional({
    example: 'Candidate passed resume screen with strong evidence.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

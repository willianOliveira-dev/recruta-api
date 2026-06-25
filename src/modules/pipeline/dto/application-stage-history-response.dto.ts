import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  APPLICATION_STAGES,
  type ApplicationStage,
} from '../../applications/domain/application-stage';

export class ApplicationStageHistoryResponseDto {
  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d9003' })
  id: string;

  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d9002' })
  applicationId: string;

  @ApiPropertyOptional({ enum: APPLICATION_STAGES, nullable: true })
  fromStage: ApplicationStage | null;

  @ApiProperty({ enum: APPLICATION_STAGES, example: 'screening' })
  toStage: ApplicationStage;

  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d88de' })
  movedBy: string;

  @ApiPropertyOptional({ nullable: true })
  reason: string | null;

  @ApiProperty()
  createdAt: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  APPLICATION_STAGES,
  type ApplicationStage,
} from '../domain/application-stage';

export class ApplicationResponseDto {
  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d9002' })
  id: string;

  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d88e0' })
  organizationId: string;

  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d9000' })
  jobId: string;

  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d9001' })
  candidateId: string;

  @ApiProperty({ enum: APPLICATION_STAGES, example: 'applied' })
  stage: ApplicationStage;

  @ApiProperty()
  stageEnteredAt: string;

  @ApiPropertyOptional({ example: 87.5, nullable: true })
  aiScore: number | null;

  @ApiPropertyOptional({ nullable: true })
  aiSummary: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiPropertyOptional({ nullable: true })
  statusToken: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class ApplicationListResponseDto {
  @ApiProperty({ type: [ApplicationResponseDto] })
  items: ApplicationResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}

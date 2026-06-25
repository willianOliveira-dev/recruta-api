import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AI_RESULT_EVENT_TYPE_VALUES,
  type AiResultEventType,
} from '../domain/ai-result-events';

export class AiResultEntityDto {
  @ApiProperty({ example: 'application' })
  @IsString()
  @MaxLength(80)
  type: string;

  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d9002' })
  @IsUUID()
  id: string;
}

export class AiResultEnvelopeDto {
  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d9003' })
  @IsString()
  @MaxLength(120)
  eventId: string;

  @ApiProperty({
    enum: AI_RESULT_EVENT_TYPE_VALUES,
    example: 'ai.match.completed',
  })
  @IsIn(AI_RESULT_EVENT_TYPE_VALUES)
  eventType: AiResultEventType;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  version: number;

  @ApiProperty({ example: '2026-06-24T12:00:00.000Z' })
  @IsString()
  occurredAt: string;

  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d88e0' })
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9004',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  correlationId?: string | null;

  @ApiProperty({ type: AiResultEntityDto })
  @ValidateNested()
  @Type(() => AiResultEntityDto)
  entity: AiResultEntityDto;

  @ApiProperty({ type: Object })
  @IsObject()
  payload: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class AiResultAcceptedResponseDto {
  @ApiProperty({ example: true })
  accepted: boolean;

  @ApiProperty({ example: true })
  processed: boolean;

  @ApiProperty({ example: false })
  duplicate: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogResponseDto {
  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d9010' })
  id: string;

  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d88e0' })
  organizationId: string;

  @ApiPropertyOptional({
    example: '01972194-7d9f-7000-9c9e-b2abdc1d88de',
    nullable: true,
  })
  userId: string | null;

  @ApiProperty({ example: 'application.stage.changed' })
  action: string;

  @ApiProperty({ example: 'application' })
  entityType: string;

  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d9002' })
  entityId: string;

  @ApiProperty()
  createdAt: string;
}

export class AuditLogListResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  items: AuditLogResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}

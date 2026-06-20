import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HttpResponseMetaDto {
  @ApiProperty({ example: '2026-06-20T15:09:40.208Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/v1/health' })
  path: string;

  @ApiProperty({ example: 'GET' })
  method: string;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiPropertyOptional({ example: '59b6b9621e5a43cab16ee72a9524c555' })
  requestId?: string;
}

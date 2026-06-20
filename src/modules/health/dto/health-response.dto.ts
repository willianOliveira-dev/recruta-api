import { ApiProperty } from '@nestjs/swagger';
import { HttpResponseMetaDto } from '../../../common/http/dto/http-response-meta.dto';

export class HealthDataDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok';

  @ApiProperty({ example: 42.5 })
  uptime: number;

  @ApiProperty({ example: '2026-06-20T15:09:40.208Z' })
  timestamp: string;
}

export class HealthResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: HealthDataDto })
  data: HealthDataDto;

  @ApiProperty({ type: HttpResponseMetaDto })
  meta: HttpResponseMetaDto;
}

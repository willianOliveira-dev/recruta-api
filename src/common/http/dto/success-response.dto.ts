import { ApiProperty } from '@nestjs/swagger';
import { HttpResponseMetaDto } from './http-response-meta.dto';

export class SuccessResponseDto<TData = unknown> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty()
  data: TData;

  @ApiProperty({ type: HttpResponseMetaDto })
  meta: HttpResponseMetaDto;
}

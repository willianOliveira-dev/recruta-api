import { ApiProperty } from '@nestjs/swagger';

export class OutboxPublishResponseDto {
  @ApiProperty({ example: 5 })
  attempted: number;

  @ApiProperty({ example: 4 })
  published: number;

  @ApiProperty({ example: 1 })
  failed: number;
}

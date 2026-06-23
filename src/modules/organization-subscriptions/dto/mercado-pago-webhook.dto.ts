import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class MercadoPagoWebhookDataDto {
  @ApiProperty({ example: '123456789' })
  @IsString()
  id: string;
}

export class MercadoPagoWebhookDto {
  @ApiPropertyOptional({ example: '12345' })
  @IsOptional()
  id?: string | number;

  @ApiProperty({ example: 'subscription_preapproval' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ example: 'updated' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiProperty({ type: MercadoPagoWebhookDataDto })
  @IsObject()
  data: MercadoPagoWebhookDataDto;
}

export class MercadoPagoWebhookAcceptedResponseDto {
  @ApiProperty({ example: true })
  accepted: boolean;
}


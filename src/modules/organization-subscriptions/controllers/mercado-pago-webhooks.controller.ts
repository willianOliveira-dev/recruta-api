import { Body, Controller, Headers, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponse } from '../../../common/http/decorators/api-standard-response.decorator';
import {
  MercadoPagoWebhookAcceptedResponseDto,
  MercadoPagoWebhookDto,
} from '../dto/mercado-pago-webhook.dto';
import { OrganizationSubscriptionsService } from '../services/organization-subscriptions.service';

@ApiTags('Billing Webhooks')
@Controller('billing/mercadopago/webhooks')
export class MercadoPagoWebhooksController {
  constructor(
    private readonly organizationSubscriptionsService: OrganizationSubscriptionsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Accept Mercado Pago billing webhook' })
  @ApiStandardResponse({
    description: 'Mercado Pago webhook accepted',
    type: MercadoPagoWebhookAcceptedResponseDto,
    errors: [403, 500, 'default'],
  })
  accept(
    @Body() dto: MercadoPagoWebhookDto,
    @Headers('x-signature') xSignature: string | string[] | undefined,
    @Headers('x-request-id') xRequestId: string | string[] | undefined,
    @Query('data.id') queryDataId?: string,
  ) {
    return this.organizationSubscriptionsService.acceptMercadoPagoWebhook({
      dto,
      xSignature,
      xRequestId,
      dataId: queryDataId ?? dto.data?.id,
    });
  }
}

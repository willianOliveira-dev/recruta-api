import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module';
import { MercadoPagoWebhooksController } from './controllers/mercado-pago-webhooks.controller';
import { OrganizationSubscriptionsController } from './controllers/organization-subscriptions.controller';
import { MercadoPagoService } from './integrations/mercado-pago.service';
import { OrganizationSubscriptionsRepository } from './repositories/organization-subscriptions.repository';
import { OrganizationSubscriptionsService } from './services/organization-subscriptions.service';

@Module({
  imports: [AuthModule, SubscriptionPlansModule],
  controllers: [
    OrganizationSubscriptionsController,
    MercadoPagoWebhooksController,
  ],
  providers: [
    OrganizationSubscriptionsRepository,
    OrganizationSubscriptionsService,
    MercadoPagoService,
  ],
  exports: [OrganizationSubscriptionsService],
})
export class OrganizationSubscriptionsModule {}


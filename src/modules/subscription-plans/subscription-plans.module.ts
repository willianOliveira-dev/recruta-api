import { Module } from '@nestjs/common';
import { SubscriptionPlansController } from './controllers/subscription-plans.controller';
import { SubscriptionPlansRepository } from './repositories/subscription-plans.repository';
import { PlanLimitsService } from './services/plan-limits.service';
import { SubscriptionPlansService } from './services/subscription-plans.service';

@Module({
  controllers: [SubscriptionPlansController],
  providers: [
    SubscriptionPlansRepository,
    SubscriptionPlansService,
    PlanLimitsService,
  ],
  exports: [
    SubscriptionPlansRepository,
    SubscriptionPlansService,
    PlanLimitsService,
  ],
})
export class SubscriptionPlansModule {}


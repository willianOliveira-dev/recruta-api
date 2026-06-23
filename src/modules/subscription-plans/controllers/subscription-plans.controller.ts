import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponse } from '../../../common/http/decorators/api-standard-response.decorator';
import {
  SubscriptionPlanResponseDto,
  SubscriptionPlansListResponseDto,
} from '../dto/subscription-plan-response.dto';
import { SubscriptionPlansService } from '../services/subscription-plans.service';

@ApiTags('Subscription Plans')
@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List active subscription plans' })
  @ApiStandardResponse({
    description: 'Active subscription plans found',
    type: SubscriptionPlansListResponseDto,
    errors: [500, 'default'],
  })
  listActive() {
    return this.subscriptionPlansService.listActive();
  }

  @Get(':slug/limits')
  @ApiOperation({ summary: 'Get subscription plan limits' })
  @ApiParam({ name: 'slug', enum: ['basic', 'plus', 'pro'] })
  @ApiStandardResponse({
    description: 'Subscription plan limits found',
    type: SubscriptionPlanResponseDto,
    errors: [404, 500, 'default'],
  })
  getPlanLimits(@Param('slug') slug: string) {
    return this.subscriptionPlansService.getPlanLimits(slug);
  }
}


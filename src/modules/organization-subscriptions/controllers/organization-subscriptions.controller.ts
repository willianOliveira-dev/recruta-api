import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentSession } from '../../../common/decorators/current-session.decorator';
import { AuthenticatedGuard } from '../../../common/guards/authenticated.guard';
import { ApiStandardResponse } from '../../../common/http/decorators/api-standard-response.decorator';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import {
  OrganizationSubscriptionResponseDto,
  PreparedPlanChangeResponseDto,
} from '../dto/organization-subscription-response.dto';
import { PreparePlanChangeDto } from '../dto/prepare-plan-change.dto';
import { OrganizationSubscriptionsService } from '../services/organization-subscriptions.service';

@ApiTags('Organization Subscriptions')
@ApiCookieAuth('better-auth.session_token')
@UseGuards(AuthenticatedGuard)
@Controller('organizations/current/subscription')
export class OrganizationSubscriptionsController {
  constructor(
    private readonly organizationSubscriptionsService: OrganizationSubscriptionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current organization subscription' })
  @ApiStandardResponse({
    description: 'Current organization subscription found',
    type: OrganizationSubscriptionResponseDto,
    errors: [400, 401, 403, 500, 'default'],
  })
  getCurrent(@CurrentSession() session: AuthenticatedSession) {
    return this.organizationSubscriptionsService.getCurrent(session);
  }

  @Post('trial')
  @ApiOperation({ summary: 'Apply trial to current organization' })
  @ApiStandardResponse({
    description: 'Trial applied to current organization',
    type: OrganizationSubscriptionResponseDto,
    errors: [400, 401, 403, 404, 409, 500, 'default'],
  })
  applyTrial(@CurrentSession() session: AuthenticatedSession) {
    return this.organizationSubscriptionsService.applyTrial(session);
  }

  @Post('change-plan')
  @ApiOperation({ summary: 'Prepare current organization plan change' })
  @ApiStandardResponse({
    description: 'Plan change prepared',
    type: PreparedPlanChangeResponseDto,
    errors: [400, 401, 403, 404, 409, 502, 503, 500, 'default'],
  })
  preparePlanChange(
    @CurrentSession() session: AuthenticatedSession,
    @Body() dto: PreparePlanChangeDto,
  ) {
    return this.organizationSubscriptionsService.preparePlanChange(session, dto);
  }
}


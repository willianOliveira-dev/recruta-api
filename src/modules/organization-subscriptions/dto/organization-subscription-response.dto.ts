import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanUsageResponseDto } from '../../subscription-plans/dto/plan-limit-response.dto';
import {
  PlanLimitsResponseDto,
  SubscriptionPlanResponseDto,
} from '../../subscription-plans/dto/subscription-plan-response.dto';

export class OrganizationSubscriptionResponseDto {
  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d88e0' })
  organizationId: string;

  @ApiPropertyOptional({ example: 'trialing', nullable: true })
  status: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: true })
  hasActiveSubscription: boolean;

  @ApiPropertyOptional({
    example: '2026-07-06T12:00:00.000Z',
    nullable: true,
  })
  trialEndsAt: string | null;

  @ApiPropertyOptional({
    example: '2026-06-22T12:00:00.000Z',
    nullable: true,
  })
  currentPeriodStart: string | null;

  @ApiPropertyOptional({
    example: '2026-07-22T12:00:00.000Z',
    nullable: true,
  })
  currentPeriodEnd: string | null;

  @ApiPropertyOptional({ type: SubscriptionPlanResponseDto, nullable: true })
  plan: SubscriptionPlanResponseDto | null;

  @ApiPropertyOptional({ type: SubscriptionPlanResponseDto, nullable: true })
  pendingPlan: SubscriptionPlanResponseDto | null;

  @ApiPropertyOptional({
    example: 'https://www.mercadopago.com.br/subscriptions/checkout?...',
    nullable: true,
  })
  checkoutUrl: string | null;

  @ApiPropertyOptional({ example: '2c938084...', nullable: true })
  gatewaySubscriptionId: string | null;

  @ApiPropertyOptional({ example: '2c938084...', nullable: true })
  pendingGatewaySubscriptionId: string | null;

  @ApiPropertyOptional({ type: PlanLimitsResponseDto, nullable: true })
  limits: PlanLimitsResponseDto | null;

  @ApiProperty({ type: PlanUsageResponseDto })
  usage: PlanUsageResponseDto;
}

export class PreparedPlanChangeResponseDto extends OrganizationSubscriptionResponseDto {
  @ApiProperty({
    example: 'https://www.mercadopago.com.br/subscriptions/checkout?...',
  })
  declare checkoutUrl: string;
}


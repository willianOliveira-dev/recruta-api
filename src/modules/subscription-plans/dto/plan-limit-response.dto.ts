import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionPlanResponseDto } from './subscription-plan-response.dto';

export class PlanUsageResponseDto {
  @ApiProperty({ example: 1 })
  currentUsers: number;

  @ApiProperty({ example: 2 })
  activeJobs: number;

  @ApiProperty({ example: 12 })
  candidatesThisMonth: number;

  @ApiProperty({ example: 45000 })
  monthlyAiTokensUsed: number;
}

export class OrganizationPlanLimitsResponseDto {
  @ApiPropertyOptional({ type: SubscriptionPlanResponseDto, nullable: true })
  plan: SubscriptionPlanResponseDto | null;

  @ApiProperty({ example: true })
  hasActiveSubscription: boolean;

  @ApiProperty({ type: PlanUsageResponseDto })
  usage: PlanUsageResponseDto;
}


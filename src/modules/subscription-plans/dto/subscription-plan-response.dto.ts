import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  COMMERCIAL_PLAN_SLUGS,
  type CommercialPlanSlug,
} from '../domain/subscription-plan';

export class PlanLimitsResponseDto {
  @ApiProperty({ example: 2 })
  maxUsers: number;

  @ApiProperty({ example: 3 })
  maxJobs: number;

  @ApiProperty({ example: 200000 })
  monthlyAiTokens: number;

  @ApiProperty({ example: 100 })
  maxCandidatesPerMonth: number;

  @ApiProperty({ example: false })
  customCareerPage: boolean;

  @ApiProperty({ example: false })
  apiAccess: boolean;

  @ApiProperty({ example: false })
  prioritySupport: boolean;
}

export class SubscriptionPlanResponseDto {
  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d8b01' })
  id: string;

  @ApiProperty({ example: 'Básico' })
  name: string;

  @ApiProperty({ enum: COMMERCIAL_PLAN_SLUGS, example: 'basic' })
  slug: CommercialPlanSlug;

  @ApiPropertyOptional({
    example:
      'Plano de entrada para equipes pequenas validarem o ATS com limites controlados.',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ example: 14900 })
  priceInCents: number;

  @ApiProperty({ example: 'BRL' })
  currency: string;

  @ApiProperty({ example: 1 })
  billingPeriodMonths: number;

  @ApiProperty({ example: 14 })
  trialDays: number;

  @ApiPropertyOptional({
    example:
      'R$149/mês cobre o uso inicial de uma equipe pequena e limita custo de IA.',
    nullable: true,
  })
  pricingJustification: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ type: PlanLimitsResponseDto })
  limits: PlanLimitsResponseDto;
}

export class SubscriptionPlansListResponseDto {
  @ApiProperty({ type: [SubscriptionPlanResponseDto] })
  plans: SubscriptionPlanResponseDto[];
}


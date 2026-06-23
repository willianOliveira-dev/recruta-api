import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  COMMERCIAL_PLAN_SLUGS,
  type CommercialPlanSlug,
} from '../../subscription-plans/domain/subscription-plan';

export class PreparePlanChangeDto {
  @ApiProperty({ enum: COMMERCIAL_PLAN_SLUGS, example: 'plus' })
  @IsIn(COMMERCIAL_PLAN_SLUGS)
  planSlug: CommercialPlanSlug;
}


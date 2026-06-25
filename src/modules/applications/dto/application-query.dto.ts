import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  APPLICATION_STAGES,
  type ApplicationStage,
} from '../domain/application-stage';

export class ApplicationListQueryDto {
  @ApiPropertyOptional({ enum: APPLICATION_STAGES })
  @IsOptional()
  @IsIn(APPLICATION_STAGES)
  stage?: ApplicationStage;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class CurrentOrganizationApplicationListQueryDto extends ApplicationListQueryDto {
  @ApiPropertyOptional({
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9001',
  })
  @IsOptional()
  @IsUUID()
  candidateId?: string;
}

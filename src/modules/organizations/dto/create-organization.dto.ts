import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OrganizationProfileDto } from './organization-profile.dto';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Recruta Tecnologia' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'recruta-tecnologia' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  slug?: string;

  @ApiPropertyOptional({ type: OrganizationProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrganizationProfileDto)
  profile?: OrganizationProfileDto;
}

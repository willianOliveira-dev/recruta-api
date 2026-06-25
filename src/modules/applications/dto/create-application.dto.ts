import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateApplicationDto {
  @ApiPropertyOptional({
    example: 'Initial recruiter screening notes',
    maxLength: 4000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class CreateCurrentOrganizationApplicationDto extends CreateApplicationDto {
  @ApiProperty({
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
    description: 'Job id when creating through the current organization route',
  })
  @IsUUID()
  jobId: string;

  @ApiProperty({
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9001',
    description:
      'Candidate id when creating through the current organization route',
  })
  @IsUUID()
  candidateId: string;
}

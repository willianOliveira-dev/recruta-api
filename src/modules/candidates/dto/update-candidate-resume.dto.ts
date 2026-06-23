import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateCandidateResumeDto {
  @ApiPropertyOptional({ example: 'https://storage.example.com/resume.pdf' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(1000)
  resumeUrl?: string;

  @ApiPropertyOptional({ example: 'Texto integral do curriculo.' })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  resumeText?: string;
}

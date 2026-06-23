import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export const CANDIDATE_RESUME_PDF_MIME_TYPE = 'application/pdf';
export const CANDIDATE_RESUME_ACCESS_DISPOSITIONS = [
  'inline',
  'attachment',
] as const;

export class RequestCandidateResumeUploadDto {
  @ApiProperty({ example: 'ana-souza-curriculo.pdf' })
  @IsString()
  @MaxLength(180)
  originalFileName: string;

  @ApiProperty({ example: 524288 })
  @IsInt()
  @Min(1)
  sizeBytes: number;

  @ApiPropertyOptional({
    example: 'c4fdbb308abe8f09622f9a21f43f2b14b1f1c1f7e6bb77a5b0c6352b4d7c7d8a',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  checksumSha256?: string;
}

export class CandidateResumeAccessQueryDto {
  @ApiPropertyOptional({
    enum: CANDIDATE_RESUME_ACCESS_DISPOSITIONS,
    example: 'inline',
  })
  @IsOptional()
  @IsIn(CANDIDATE_RESUME_ACCESS_DISPOSITIONS)
  disposition?: (typeof CANDIDATE_RESUME_ACCESS_DISPOSITIONS)[number];
}

export class CandidateResumeFileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  candidateId: string;

  @ApiProperty()
  storageProvider: string;

  @ApiProperty()
  bucket: string;

  @ApiProperty()
  objectKey: string;

  @ApiProperty()
  originalFileName: string;

  @ApiProperty({ example: CANDIDATE_RESUME_PDF_MIME_TYPE })
  mimeType: typeof CANDIDATE_RESUME_PDF_MIME_TYPE;

  @ApiProperty()
  sizeBytes: number;

  @ApiPropertyOptional({ nullable: true })
  checksumSha256: string | null;

  @ApiProperty({ enum: ['pending', 'uploaded', 'rejected', 'deleted'] })
  status: 'pending' | 'uploaded' | 'rejected' | 'deleted';

  @ApiProperty()
  isCurrent: boolean;

  @ApiPropertyOptional({ nullable: true })
  uploadedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  rejectedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  rejectionReason: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class CandidateResumeUploadUrlResponseDto {
  @ApiProperty({ type: CandidateResumeFileResponseDto })
  file: CandidateResumeFileResponseDto;

  @ApiProperty()
  uploadUrl: string;

  @ApiProperty({ example: 'PUT' })
  method: 'PUT';

  @ApiProperty({ example: { 'Content-Type': CANDIDATE_RESUME_PDF_MIME_TYPE } })
  headers: Record<string, string>;

  @ApiProperty()
  expiresAt: string;
}

export class CandidateResumeAccessUrlResponseDto {
  @ApiProperty({ type: CandidateResumeFileResponseDto })
  file: CandidateResumeFileResponseDto;

  @ApiProperty()
  accessUrl: string;

  @ApiProperty({ example: 'GET' })
  method: 'GET';

  @ApiProperty()
  expiresAt: string;
}

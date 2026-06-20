import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HttpResponseMetaDto } from './http-response-meta.dto';
import { ValidationIssueDto } from './validation-issue.dto';

export class ApiErrorDto {
  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code: string;

  @ApiProperty({ example: 'Validation failed' })
  message: string;

  @ApiPropertyOptional({
    type: [ValidationIssueDto],
    description: 'Structured error details when available.',
  })
  details?: ValidationIssueDto[];
}

export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success: false;

  @ApiProperty({ type: ApiErrorDto })
  error: ApiErrorDto;

  @ApiProperty({ type: HttpResponseMetaDto })
  meta: HttpResponseMetaDto;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidationIssueDto {
  @ApiProperty({ example: 'email' })
  field: string;

  @ApiProperty({
    example: ['email must be an email'],
    type: [String],
  })
  messages: string[];

  @ApiPropertyOptional({ example: 'body.user.email' })
  path?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InterviewNoteResponseDto {
  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d9004' })
  id: string;

  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d9002' })
  applicationId: string;

  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d88de' })
  authorId: string;

  @ApiProperty({
    example:
      'Candidate gave strong STAR evidence for backend incident response.',
  })
  content: string;

  @ApiPropertyOptional({ example: 4, nullable: true })
  rating: number | null;

  @ApiProperty({ example: true })
  includeInAiContext: boolean;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

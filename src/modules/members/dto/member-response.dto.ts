import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MEMBER_ROLES, type MemberRole } from '../domain/member-role';

export class MemberUserResponseDto {
  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d88de' })
  id: string;

  @ApiProperty({ example: 'Ana Recruiter' })
  name: string;

  @ApiProperty({ example: 'ana@recruta.test' })
  email: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.png' })
  image?: string | null;
}

export class MemberResponseDto {
  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d88e1' })
  id: string;

  @ApiProperty({ enum: MEMBER_ROLES, example: 'owner' })
  role: MemberRole;

  @ApiProperty({ example: '2026-06-21T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ type: MemberUserResponseDto })
  user: MemberUserResponseDto;
}

export class MembersLimitResponseDto {
  @ApiProperty({ example: 2 })
  currentUsers: number;

  @ApiPropertyOptional({ example: 3, nullable: true })
  maxUsers: number | null;

  @ApiPropertyOptional({ example: 1, nullable: true })
  seatsRemaining: number | null;
}

export class MembersListResponseDto {
  @ApiProperty({ type: [MemberResponseDto] })
  members: MemberResponseDto[];

  @ApiProperty({ type: MembersLimitResponseDto })
  limit: MembersLimitResponseDto;
}

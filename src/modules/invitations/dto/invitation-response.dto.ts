import { ApiProperty } from '@nestjs/swagger';
import { MEMBER_ROLES, type MemberRole } from '../../members/domain/member-role';
import {
  INVITATION_STATUSES,
  type InvitationStatus,
} from '../domain/invitation-rules';

export class InvitationResponseDto {
  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d88e4' })
  id: string;

  @ApiProperty({ example: 'recruiter@recruta.test' })
  email: string;

  @ApiProperty({ enum: MEMBER_ROLES, example: 'recruiter' })
  role: MemberRole;

  @ApiProperty({ enum: INVITATION_STATUSES, example: 'pending' })
  status: InvitationStatus;

  @ApiProperty({ example: '2026-06-28T12:00:00.000Z' })
  expiresAt: string;

  @ApiProperty({ example: '2026-06-21T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '01972194-7d9f-7000-9c9e-b2abdc1d88de' })
  inviterId: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { MEMBER_ROLES, type MemberRole } from '../domain/member-role';

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: MEMBER_ROLES,
    example: 'recruiter',
  })
  @IsIn(MEMBER_ROLES)
  role: MemberRole;
}

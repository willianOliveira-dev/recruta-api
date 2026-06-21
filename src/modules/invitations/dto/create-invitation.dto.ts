import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, MaxLength } from 'class-validator';
import { MEMBER_ROLES, type MemberRole } from '../../members/domain/member-role';

export class CreateInvitationDto {
  @ApiProperty({ example: 'recruiter@recruta.test' })
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiPropertyOptional({ enum: MEMBER_ROLES, example: 'recruiter' })
  @IsOptional()
  @IsIn(MEMBER_ROLES)
  role?: MemberRole;
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentSession } from '../../../common/decorators/current-session.decorator';
import { AuthenticatedGuard } from '../../../common/guards/authenticated.guard';
import { ApiStandardResponse } from '../../../common/http/decorators/api-standard-response.decorator';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import {
  MemberResponseDto,
  MembersListResponseDto,
} from '../dto/member-response.dto';
import { UpdateMemberRoleDto } from '../dto/update-member-role.dto';
import { MembersService } from '../services/members.service';

@ApiTags('Members')
@ApiCookieAuth('better-auth.session_token')
@UseGuards(AuthenticatedGuard)
@Controller('organizations/current/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({ summary: 'List current organization members' })
  @ApiStandardResponse({
    description: 'Current organization members found',
    type: MembersListResponseDto,
    errors: [400, 401, 403, 500, 'default'],
  })
  listCurrent(@CurrentSession() session: AuthenticatedSession) {
    return this.membersService.listCurrent(session);
  }

  @Patch(':memberId/role')
  @ApiOperation({ summary: 'Update current organization member role' })
  @ApiParam({
    name: 'memberId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d88e3',
  })
  @ApiStandardResponse({
    description: 'Current organization member role updated',
    type: MemberResponseDto,
    errors: [400, 401, 403, 404, 409, 500, 'default'],
  })
  updateRole(
    @CurrentSession() session: AuthenticatedSession,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.membersService.updateRole(session, memberId, dto);
  }

  @Delete(':memberId')
  @ApiOperation({ summary: 'Remove current organization member' })
  @ApiParam({
    name: 'memberId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d88e3',
  })
  @ApiStandardResponse({
    description: 'Current organization member removed',
    type: MemberResponseDto,
    errors: [400, 401, 403, 404, 409, 500, 'default'],
  })
  remove(
    @CurrentSession() session: AuthenticatedSession,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.membersService.remove(session, memberId);
  }
}

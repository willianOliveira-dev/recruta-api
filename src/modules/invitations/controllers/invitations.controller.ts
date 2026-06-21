import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
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
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { InvitationResponseDto } from '../dto/invitation-response.dto';
import { InvitationsService } from '../services/invitations.service';

@ApiTags('Invitations')
@ApiCookieAuth('better-auth.session_token')
@UseGuards(AuthenticatedGuard)
@Controller('organizations/current/invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create current organization invitation',
    operationId: 'createCurrentOrganizationInvitation',
  })
  @ApiStandardResponse({
    description: 'Current organization invitation created',
    type: InvitationResponseDto,
    errors: [400, 401, 403, 409, 500, 'default'],
  })
  create(
    @CurrentSession() session: AuthenticatedSession,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.create(session, dto);
  }

  @Post(':invitationId/resend')
  @ApiOperation({
    summary: 'Resend current organization invitation',
    operationId: 'resendCurrentOrganizationInvitation',
  })
  @ApiParam({
    name: 'invitationId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d88e4',
  })
  @ApiStandardResponse({
    description: 'Current organization invitation resent',
    type: InvitationResponseDto,
    errors: [400, 401, 403, 404, 409, 500, 'default'],
  })
  resend(
    @CurrentSession() session: AuthenticatedSession,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.invitationsService.resend(session, invitationId);
  }

  @Post(':invitationId/cancel')
  @ApiOperation({
    summary: 'Cancel current organization invitation',
    operationId: 'cancelCurrentOrganizationInvitation',
  })
  @ApiParam({
    name: 'invitationId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d88e4',
  })
  @ApiStandardResponse({
    description: 'Current organization invitation canceled',
    type: InvitationResponseDto,
    errors: [400, 401, 403, 404, 409, 500, 'default'],
  })
  cancel(
    @CurrentSession() session: AuthenticatedSession,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.invitationsService.cancel(session, invitationId);
  }

  @Post(':invitationId/accept')
  @ApiOperation({
    summary: 'Accept current organization invitation',
    operationId: 'acceptCurrentOrganizationInvitation',
  })
  @ApiParam({
    name: 'invitationId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d88e4',
  })
  @ApiStandardResponse({
    description: 'Current organization invitation accepted',
    type: InvitationResponseDto,
    errors: [400, 401, 403, 404, 409, 500, 'default'],
  })
  accept(
    @CurrentSession() session: AuthenticatedSession,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.invitationsService.accept(session, invitationId);
  }
}

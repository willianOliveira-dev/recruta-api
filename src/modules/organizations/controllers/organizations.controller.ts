import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentSession } from '../../../common/decorators/current-session.decorator';
import { AuthenticatedGuard } from '../../../common/guards/authenticated.guard';
import { ApiStandardResponse } from '../../../common/http/decorators/api-standard-response.decorator';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { OrganizationProfileDto } from '../dto/organization-profile.dto';
import { OrganizationResponseDto } from '../dto/organization-response.dto';
import { OrganizationsService } from '../services/organizations.service';

@ApiTags('Organizations')
@ApiCookieAuth('better-auth.session_token')
@UseGuards(AuthenticatedGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create organization' })
  @ApiStandardResponse({
    description: 'Organization created',
    type: OrganizationResponseDto,
    errors: [400, 401, 409, 500, 'default'],
  })
  create(
    @CurrentSession() session: AuthenticatedSession,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.create(session, dto);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get active organization' })
  @ApiStandardResponse({
    description: 'Active organization found',
    type: OrganizationResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  getCurrent(@CurrentSession() session: AuthenticatedSession) {
    return this.organizationsService.getCurrent(session);
  }

  @Patch('current/profile')
  @ApiOperation({ summary: 'Update active organization profile' })
  @ApiStandardResponse({
    description: 'Active organization profile updated',
    type: OrganizationResponseDto,
    errors: [400, 401, 403, 404, 409, 500, 'default'],
  })
  updateCurrentProfile(
    @CurrentSession() session: AuthenticatedSession,
    @Body() dto: OrganizationProfileDto,
  ) {
    return this.organizationsService.updateCurrentProfile(session, dto);
  }
}

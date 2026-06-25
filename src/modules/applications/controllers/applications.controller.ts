import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
  ApplicationListQueryDto,
  CurrentOrganizationApplicationListQueryDto,
} from '../dto/application-query.dto';
import {
  ApplicationListResponseDto,
  ApplicationResponseDto,
} from '../dto/application-response.dto';
import {
  CreateApplicationDto,
  CreateCurrentOrganizationApplicationDto,
} from '../dto/create-application.dto';
import { UpdateApplicationNotesDto } from '../dto/update-application-notes.dto';
import { ApplicationsService } from '../services/applications.service';

@ApiTags('Applications')
@ApiCookieAuth('better-auth.session_token')
@UseGuards(AuthenticatedGuard)
@Controller()
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post('organizations/current/applications')
  @ApiOperation({
    summary: 'Create current organization application',
    operationId: 'createCurrentOrganizationApplication',
  })
  @ApiStandardResponse({
    description: 'Current organization application created',
    type: ApplicationResponseDto,
    errors: [400, 401, 403, 404, 409, 500, 'default'],
  })
  createForCurrentOrganization(
    @CurrentSession() session: AuthenticatedSession,
    @Body() dto: CreateCurrentOrganizationApplicationDto,
  ) {
    return this.applicationsService.createForCurrentOrganization(session, dto);
  }

  @Post('jobs/:jobId/candidates/:candidateId/applications')
  @ApiOperation({
    summary: 'Create organization application for job and candidate',
    operationId: 'createOrganizationApplicationForJobCandidate',
  })
  @ApiParam({
    name: 'jobId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @ApiParam({
    name: 'candidateId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9001',
  })
  @ApiStandardResponse({
    description: 'Organization application created',
    type: ApplicationResponseDto,
    errors: [400, 401, 403, 404, 409, 500, 'default'],
  })
  create(
    @CurrentSession() session: AuthenticatedSession,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(session, jobId, candidateId, dto);
  }

  @Get('organizations/current/applications')
  @ApiOperation({
    summary: 'List current organization applications',
    operationId: 'listCurrentOrganizationApplications',
  })
  @ApiStandardResponse({
    description: 'Current organization applications listed',
    type: ApplicationListResponseDto,
    errors: [400, 401, 403, 500, 'default'],
  })
  listForCurrentOrganization(
    @CurrentSession() session: AuthenticatedSession,
    @Query() query: CurrentOrganizationApplicationListQueryDto,
  ) {
    return this.applicationsService.listForCurrentOrganization(session, query);
  }

  @Get('jobs/:jobId/applications')
  @ApiOperation({
    summary: 'List organization applications by job',
    operationId: 'listOrganizationApplicationsByJob',
  })
  @ApiParam({
    name: 'jobId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @ApiStandardResponse({
    description: 'Organization applications by job listed',
    type: ApplicationListResponseDto,
    errors: [400, 401, 403, 500, 'default'],
  })
  listByJob(
    @CurrentSession() session: AuthenticatedSession,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query() query: ApplicationListQueryDto,
  ) {
    return this.applicationsService.listByJob(session, jobId, query);
  }

  @Get('candidates/:candidateId/applications')
  @ApiOperation({
    summary: 'List organization applications by candidate',
    operationId: 'listOrganizationApplicationsByCandidate',
  })
  @ApiParam({
    name: 'candidateId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9001',
  })
  @ApiStandardResponse({
    description: 'Organization applications by candidate listed',
    type: ApplicationListResponseDto,
    errors: [400, 401, 403, 500, 'default'],
  })
  listByCandidate(
    @CurrentSession() session: AuthenticatedSession,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Query() query: ApplicationListQueryDto,
  ) {
    return this.applicationsService.listByCandidate(
      session,
      candidateId,
      query,
    );
  }

  @Patch('applications/:applicationId/notes')
  @ApiOperation({
    summary: 'Update organization application notes',
    operationId: 'updateOrganizationApplicationNotes',
  })
  @ApiParam({
    name: 'applicationId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9002',
  })
  @ApiStandardResponse({
    description: 'Organization application notes updated',
    type: ApplicationResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  updateNotes(
    @CurrentSession() session: AuthenticatedSession,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: UpdateApplicationNotesDto,
  ) {
    return this.applicationsService.updateNotes(session, applicationId, dto);
  }
}

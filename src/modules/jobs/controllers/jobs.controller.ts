import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { CreateJobDto } from '../dto/create-job.dto';
import { JobResponseDto } from '../dto/job-response.dto';
import { ReplaceJobSkillsDto } from '../dto/job-skill.dto';
import { UpdateJobDto } from '../dto/update-job.dto';
import { JobsService } from '../services/jobs.service';

@ApiTags('Jobs')
@ApiCookieAuth('better-auth.session_token')
@UseGuards(AuthenticatedGuard)
@Controller()
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post('organizations/current/jobs')
  @ApiOperation({
    summary: 'Create current organization job draft',
    operationId: 'createCurrentOrganizationJob',
  })
  @ApiStandardResponse({
    description: 'Current organization job draft created',
    type: JobResponseDto,
    errors: [400, 401, 403, 500, 'default'],
  })
  create(
    @CurrentSession() session: AuthenticatedSession,
    @Body() dto: CreateJobDto,
  ) {
    return this.jobsService.create(session, dto);
  }

  @Patch('jobs/:jobId')
  @ApiOperation({
    summary: 'Update organization job',
    operationId: 'updateOrganizationJob',
  })
  @ApiParam({
    name: 'jobId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @ApiStandardResponse({
    description: 'Organization job updated',
    type: JobResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  update(
    @CurrentSession() session: AuthenticatedSession,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobsService.update(session, jobId, dto);
  }

  @Post('jobs/:jobId/publish')
  @ApiOperation({
    summary: 'Publish organization job',
    operationId: 'publishOrganizationJob',
  })
  @ApiParam({
    name: 'jobId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @ApiStandardResponse({
    description: 'Organization job published',
    type: JobResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  publish(
    @CurrentSession() session: AuthenticatedSession,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    return this.jobsService.publish(session, jobId);
  }

  @Post('jobs/:jobId/pause')
  @ApiOperation({
    summary: 'Pause organization job',
    operationId: 'pauseOrganizationJob',
  })
  @ApiParam({
    name: 'jobId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @ApiStandardResponse({
    description: 'Organization job paused',
    type: JobResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  pause(
    @CurrentSession() session: AuthenticatedSession,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    return this.jobsService.pause(session, jobId);
  }

  @Post('jobs/:jobId/close')
  @ApiOperation({
    summary: 'Close organization job',
    operationId: 'closeOrganizationJob',
  })
  @ApiParam({
    name: 'jobId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @ApiStandardResponse({
    description: 'Organization job closed',
    type: JobResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  close(
    @CurrentSession() session: AuthenticatedSession,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    return this.jobsService.close(session, jobId);
  }

  @Post('jobs/:jobId/archive')
  @ApiOperation({
    summary: 'Archive organization job',
    operationId: 'archiveOrganizationJob',
  })
  @ApiParam({
    name: 'jobId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @ApiStandardResponse({
    description: 'Organization job archived',
    type: JobResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  archive(
    @CurrentSession() session: AuthenticatedSession,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    return this.jobsService.archive(session, jobId);
  }

  @Put('jobs/:jobId/skills')
  @ApiOperation({
    summary: 'Replace organization job skills',
    operationId: 'replaceOrganizationJobSkills',
  })
  @ApiParam({
    name: 'jobId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @ApiStandardResponse({
    description: 'Organization job skills replaced',
    type: JobResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  replaceSkills(
    @CurrentSession() session: AuthenticatedSession,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: ReplaceJobSkillsDto,
  ) {
    return this.jobsService.replaceSkills(session, jobId, dto.skills);
  }
}

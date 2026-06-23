import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
  CandidateResumeAccessQueryDto,
  CandidateResumeAccessUrlResponseDto,
  CandidateResumeFileResponseDto,
  CandidateResumeUploadUrlResponseDto,
  RequestCandidateResumeUploadDto,
} from '../dto/candidate-resume-file.dto';
import { CandidateResponseDto } from '../dto/candidate-response.dto';
import { ReplaceCandidateExperiencesDto } from '../dto/candidate-experience.dto';
import { ReplaceCandidateSkillsDto } from '../dto/candidate-skill.dto';
import { CreateCandidateDto } from '../dto/create-candidate.dto';
import { UpdateCandidateResumeDto } from '../dto/update-candidate-resume.dto';
import { UpdateCandidateDto } from '../dto/update-candidate.dto';
import { CandidateResumeFilesService } from '../services/candidate-resume-files.service';
import { CandidatesService } from '../services/candidates.service';

@ApiTags('Candidates')
@ApiCookieAuth('better-auth.session_token')
@UseGuards(AuthenticatedGuard)
@Controller()
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly resumeFilesService: CandidateResumeFilesService,
  ) {}

  @Post('organizations/current/candidates')
  @ApiOperation({
    summary: 'Create current organization candidate',
    operationId: 'createCurrentOrganizationCandidate',
  })
  @ApiStandardResponse({
    description: 'Current organization candidate created',
    type: CandidateResponseDto,
    errors: [400, 401, 403, 409, 500, 'default'],
  })
  create(
    @CurrentSession() session: AuthenticatedSession,
    @Body() dto: CreateCandidateDto,
  ) {
    return this.candidatesService.create(session, dto);
  }

  @Patch('candidates/:candidateId')
  @ApiOperation({
    summary: 'Update organization candidate',
    operationId: 'updateOrganizationCandidate',
  })
  @ApiParam({
    name: 'candidateId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @ApiStandardResponse({
    description: 'Organization candidate updated',
    type: CandidateResponseDto,
    errors: [400, 401, 403, 404, 409, 500, 'default'],
  })
  update(
    @CurrentSession() session: AuthenticatedSession,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Body() dto: UpdateCandidateDto,
  ) {
    return this.candidatesService.update(session, candidateId, dto);
  }

  @Put('candidates/:candidateId/skills')
  @ApiOperation({
    summary: 'Replace organization candidate skills',
    operationId: 'replaceOrganizationCandidateSkills',
  })
  @ApiParam({
    name: 'candidateId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @ApiStandardResponse({
    description: 'Organization candidate skills replaced',
    type: CandidateResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  replaceSkills(
    @CurrentSession() session: AuthenticatedSession,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Body() dto: ReplaceCandidateSkillsDto,
  ) {
    return this.candidatesService.replaceSkills(
      session,
      candidateId,
      dto.skills,
    );
  }

  @Put('candidates/:candidateId/experiences')
  @ApiOperation({
    summary: 'Replace organization candidate experiences',
    operationId: 'replaceOrganizationCandidateExperiences',
  })
  @ApiParam({
    name: 'candidateId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @ApiStandardResponse({
    description: 'Organization candidate experiences replaced',
    type: CandidateResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  replaceExperiences(
    @CurrentSession() session: AuthenticatedSession,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Body() dto: ReplaceCandidateExperiencesDto,
  ) {
    return this.candidatesService.replaceExperiences(
      session,
      candidateId,
      dto.experiences,
    );
  }

  @Patch('candidates/:candidateId/resume')
  @ApiOperation({
    summary: 'Update organization candidate resume',
    operationId: 'updateOrganizationCandidateResume',
  })
  @ApiParam({
    name: 'candidateId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @ApiStandardResponse({
    description: 'Organization candidate resume updated',
    type: CandidateResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  updateResume(
    @CurrentSession() session: AuthenticatedSession,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Body() dto: UpdateCandidateResumeDto,
  ) {
    return this.candidatesService.updateResume(session, candidateId, dto);
  }

  @Post('candidates/:candidateId/resume-files/upload-url')
  @ApiOperation({
    summary: 'Create candidate resume PDF upload URL',
    operationId: 'createCandidateResumeFileUploadUrl',
  })
  @ApiParam({
    name: 'candidateId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @ApiStandardResponse({
    description: 'Candidate resume PDF upload URL created',
    type: CandidateResumeUploadUrlResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  requestResumeUploadUrl(
    @CurrentSession() session: AuthenticatedSession,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Body() dto: RequestCandidateResumeUploadDto,
  ) {
    return this.resumeFilesService.requestUploadUrl(session, candidateId, dto);
  }

  @Post('candidates/:candidateId/resume-files/:resumeFileId/confirm')
  @ApiOperation({
    summary: 'Confirm candidate resume PDF upload',
    operationId: 'confirmCandidateResumeFileUpload',
  })
  @ApiParam({
    name: 'candidateId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @ApiParam({
    name: 'resumeFileId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9001',
  })
  @ApiStandardResponse({
    description: 'Candidate resume PDF upload confirmed',
    type: CandidateResumeFileResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  confirmResumeUpload(
    @CurrentSession() session: AuthenticatedSession,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Param('resumeFileId', ParseUUIDPipe) resumeFileId: string,
  ) {
    return this.resumeFilesService.confirmUpload(
      session,
      candidateId,
      resumeFileId,
    );
  }

  @Get('candidates/:candidateId/resume-files/current/access-url')
  @ApiOperation({
    summary: 'Create current candidate resume PDF access URL',
    operationId: 'createCurrentCandidateResumeFileAccessUrl',
  })
  @ApiParam({
    name: 'candidateId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9000',
  })
  @ApiStandardResponse({
    description: 'Current candidate resume PDF access URL created',
    type: CandidateResumeAccessUrlResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  createCurrentResumeAccessUrl(
    @CurrentSession() session: AuthenticatedSession,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Query() query: CandidateResumeAccessQueryDto,
  ) {
    return this.resumeFilesService.createCurrentAccessUrl(
      session,
      candidateId,
      query.disposition ?? 'inline',
    );
  }
}

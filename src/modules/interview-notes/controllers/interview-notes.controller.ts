import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CreateInterviewNoteDto } from '../dto/create-interview-note.dto';
import { InterviewNoteResponseDto } from '../dto/interview-note-response.dto';
import { UpdateInterviewNoteDto } from '../dto/update-interview-note.dto';
import { InterviewNotesService } from '../services/interview-notes.service';

@ApiTags('Interview notes')
@ApiCookieAuth('better-auth.session_token')
@UseGuards(AuthenticatedGuard)
@Controller()
export class InterviewNotesController {
  constructor(private readonly interviewNotesService: InterviewNotesService) {}

  @Post('applications/:applicationId/interview-notes')
  @ApiOperation({
    summary: 'Create organization application interview note',
    operationId: 'createOrganizationApplicationInterviewNote',
  })
  @ApiParam({
    name: 'applicationId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9002',
  })
  @ApiStandardResponse({
    description: 'Organization application interview note created',
    type: InterviewNoteResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  create(
    @CurrentSession() session: AuthenticatedSession,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: CreateInterviewNoteDto,
  ) {
    return this.interviewNotesService.create(session, applicationId, dto);
  }

  @Patch('interview-notes/:noteId')
  @ApiOperation({
    summary: 'Update organization interview note',
    operationId: 'updateOrganizationInterviewNote',
  })
  @ApiParam({
    name: 'noteId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9004',
  })
  @ApiStandardResponse({
    description: 'Organization interview note updated',
    type: InterviewNoteResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  update(
    @CurrentSession() session: AuthenticatedSession,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateInterviewNoteDto,
  ) {
    return this.interviewNotesService.update(session, noteId, dto);
  }

  @Get('applications/:applicationId/interview-notes')
  @ApiOperation({
    summary: 'List organization application interview notes',
    operationId: 'listOrganizationApplicationInterviewNotes',
  })
  @ApiParam({
    name: 'applicationId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9002',
  })
  @ApiStandardResponse({
    description: 'Organization application interview notes listed',
    type: InterviewNoteResponseDto,
    isArray: true,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  listByApplication(
    @CurrentSession() session: AuthenticatedSession,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return this.interviewNotesService.listByApplication(
      session,
      applicationId,
    );
  }
}

import {
  Body,
  Controller,
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
import { ApplicationResponseDto } from '../../applications/dto/application-response.dto';
import { ApplicationStageHistoryResponseDto } from '../dto/application-stage-history-response.dto';
import { MoveApplicationStageDto } from '../dto/move-application-stage.dto';
import { PipelineService } from '../services/pipeline.service';

@ApiTags('Pipeline')
@ApiCookieAuth('better-auth.session_token')
@UseGuards(AuthenticatedGuard)
@Controller()
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Patch('applications/:applicationId/stage')
  @ApiOperation({
    summary: 'Move organization application stage',
    operationId: 'moveOrganizationApplicationStage',
  })
  @ApiParam({
    name: 'applicationId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9002',
  })
  @ApiStandardResponse({
    description: 'Organization application stage moved',
    type: ApplicationResponseDto,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  moveStage(
    @CurrentSession() session: AuthenticatedSession,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: MoveApplicationStageDto,
  ) {
    return this.pipelineService.moveStage(session, applicationId, dto);
  }

  @Get('applications/:applicationId/stage-history')
  @ApiOperation({
    summary: 'List organization application stage history',
    operationId: 'listOrganizationApplicationStageHistory',
  })
  @ApiParam({
    name: 'applicationId',
    example: '01972194-7d9f-7000-9c9e-b2abdc1d9002',
  })
  @ApiStandardResponse({
    description: 'Organization application stage history listed',
    type: ApplicationStageHistoryResponseDto,
    isArray: true,
    errors: [400, 401, 403, 404, 500, 'default'],
  })
  listHistory(
    @CurrentSession() session: AuthenticatedSession,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return this.pipelineService.listHistory(session, applicationId);
  }
}

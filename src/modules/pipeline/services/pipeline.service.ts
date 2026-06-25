import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  APP_LOGGER,
  type ApplicationLogger,
} from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import type { ApplicationResponseDto } from '../../applications/dto/application-response.dto';
import { PIPELINE_MANAGER_ROLES } from '../domain/pipeline-permissions';
import type { ApplicationStageHistoryResponseDto } from '../dto/application-stage-history-response.dto';
import type { MoveApplicationStageDto } from '../dto/move-application-stage.dto';
import {
  type ApplicationStageHistoryRecord,
  type PipelineActorRecord,
  type PipelineApplicationRecord,
  PipelineRepository,
} from '../repositories/pipeline.repository';

@Injectable()
export class PipelineService {
  constructor(
    private readonly pipelineRepository: PipelineRepository,
    @Inject(APP_LOGGER)
    private readonly logger: ApplicationLogger,
  ) {}

  async moveStage(
    session: AuthenticatedSession,
    applicationId: string,
    dto: MoveApplicationStageDto,
  ): Promise<ApplicationResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);

    const result = await this.pipelineRepository.moveStage({
      organizationId,
      applicationId,
      actorUserId: session.user.id,
      toStage: dto.stage,
      reason: this.optionalTrim(dto.reason),
    });

    if (!result) {
      this.throwApplicationNotFound();
    }

    this.logger.log(
      {
        event: 'application.stage.changed',
        organizationId,
        actorUserId: session.user.id,
        applicationId,
        fromStage: result.history.fromStage,
        toStage: result.history.toStage,
        historyId: result.history.id,
      },
      'PipelineService',
    );

    return this.toApplicationResponse(result.application);
  }

  async listHistory(
    session: AuthenticatedSession,
    applicationId: string,
  ): Promise<ApplicationStageHistoryResponseDto[]> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);

    const history = await this.pipelineRepository.listHistory(
      organizationId,
      applicationId,
    );

    if (!history) {
      this.throwApplicationNotFound();
    }

    return history.map((item) => this.toHistoryResponse(item));
  }

  private async assertActionAllowed(
    session: AuthenticatedSession,
    organizationId: string,
  ) {
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManagePipeline(actor, session.user.id, organizationId);
  }

  private async getScopedActor(
    session: AuthenticatedSession,
    organizationId: string,
  ): Promise<PipelineActorRecord> {
    const actor = await this.pipelineRepository.findActorMember(
      organizationId,
      session.user.id,
    );

    if (actor) {
      return actor;
    }

    this.logger.warn(
      {
        event: 'pipeline.scope_forbidden',
        organizationId,
        actorUserId: session.user.id,
      },
      'PipelineService',
    );

    throw new ForbiddenException({
      code: 'ORGANIZATION_SCOPE_FORBIDDEN',
      message: 'User is not a member of the active organization',
    });
  }

  private assertCanManagePipeline(
    actor: PipelineActorRecord,
    actorUserId: string,
    organizationId: string,
  ) {
    if (PIPELINE_MANAGER_ROLES.has(actor.role)) {
      return;
    }

    this.logger.warn(
      {
        event: 'pipeline.manage_forbidden',
        organizationId,
        actorUserId,
        actorRole: actor.role,
      },
      'PipelineService',
    );

    throw new ForbiddenException({
      code: 'PIPELINE_MANAGEMENT_FORBIDDEN',
      message: 'Only organization owners and recruiters can manage pipeline',
    });
  }

  private optionalTrim(value?: string | null) {
    if (value === undefined) {
      return null;
    }

    const trimmed = value?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : null;
  }

  private getActiveOrganizationId(session: AuthenticatedSession): string {
    if (!session.session.activeOrganizationId) {
      throw new BadRequestException({
        code: 'NO_ACTIVE_ORGANIZATION',
        message: 'No active organization selected',
      });
    }

    return session.session.activeOrganizationId;
  }

  private throwApplicationNotFound(): never {
    throw new NotFoundException({
      code: 'APPLICATION_NOT_FOUND',
      message: 'Organization application was not found',
    });
  }

  private toApplicationResponse(
    record: PipelineApplicationRecord,
  ): ApplicationResponseDto {
    return {
      id: record.id,
      organizationId: record.organizationId,
      jobId: record.jobId,
      candidateId: record.candidateId,
      stage: record.stage,
      stageEnteredAt: record.stageEnteredAt.toISOString(),
      aiScore: record.aiScore === null ? null : Number(record.aiScore),
      aiSummary: record.aiSummary ?? null,
      notes: record.notes ?? null,
      statusToken: record.statusToken ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toHistoryResponse(
    record: ApplicationStageHistoryRecord,
  ): ApplicationStageHistoryResponseDto {
    return {
      id: record.id,
      applicationId: record.applicationId,
      fromStage: record.fromStage ?? null,
      toStage: record.toStage,
      movedBy: record.movedBy,
      reason: record.reason ?? null,
      createdAt: record.createdAt.toISOString(),
    };
  }
}

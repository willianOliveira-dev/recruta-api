import {
  BadRequestException,
  ConflictException,
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
import { APPLICATION_MANAGER_ROLES } from '../domain/application-permissions';
import type {
  ApplicationListQueryDto,
  CurrentOrganizationApplicationListQueryDto,
} from '../dto/application-query.dto';
import type { ApplicationResponseDto } from '../dto/application-response.dto';
import type {
  CreateApplicationDto,
  CreateCurrentOrganizationApplicationDto,
} from '../dto/create-application.dto';
import type { UpdateApplicationNotesDto } from '../dto/update-application-notes.dto';
import {
  type ApplicationActorRecord,
  type ApplicationRecord,
  ApplicationsRepository,
} from '../repositories/applications.repository';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly applicationsRepository: ApplicationsRepository,
    @Inject(APP_LOGGER)
    private readonly logger: ApplicationLogger,
  ) {}

  async createForCurrentOrganization(
    session: AuthenticatedSession,
    dto: CreateCurrentOrganizationApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return this.create(session, dto.jobId, dto.candidateId, dto);
  }

  async create(
    session: AuthenticatedSession,
    jobId: string,
    candidateId: string,
    dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);
    await this.assertReferencesExist(organizationId, jobId, candidateId);

    try {
      const created = await this.applicationsRepository.create({
        organizationId,
        jobId,
        candidateId,
        actorUserId: session.user.id,
        notes: this.optionalTrim(dto.notes),
      });

      this.logger.log(
        {
          event: 'application.created',
          organizationId,
          actorUserId: session.user.id,
          applicationId: created.id,
          jobId,
          candidateId,
        },
        'ApplicationsService',
      );

      return this.toResponse(created);
    } catch (error) {
      this.mapApplicationConflict(error);
      throw error;
    }
  }

  async listForCurrentOrganization(
    session: AuthenticatedSession,
    query: CurrentOrganizationApplicationListQueryDto,
  ) {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);

    const result = await this.applicationsRepository.list({
      organizationId,
      jobId: query.jobId,
      candidateId: query.candidateId,
      stage: query.stage,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      ...result,
      items: result.items.map((item) => this.toResponse(item)),
    };
  }

  async listByJob(
    session: AuthenticatedSession,
    jobId: string,
    query: ApplicationListQueryDto,
  ) {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);

    const result = await this.applicationsRepository.list({
      organizationId,
      jobId,
      stage: query.stage,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      ...result,
      items: result.items.map((item) => this.toResponse(item)),
    };
  }

  async listByCandidate(
    session: AuthenticatedSession,
    candidateId: string,
    query: ApplicationListQueryDto,
  ) {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);

    const result = await this.applicationsRepository.list({
      organizationId,
      candidateId,
      stage: query.stage,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      ...result,
      items: result.items.map((item) => this.toResponse(item)),
    };
  }

  async updateNotes(
    session: AuthenticatedSession,
    applicationId: string,
    dto: UpdateApplicationNotesDto,
  ): Promise<ApplicationResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);

    const updated = await this.applicationsRepository.updateNotes({
      organizationId,
      applicationId,
      actorUserId: session.user.id,
      notes: this.optionalTrim(dto.notes),
    });

    if (!updated) {
      this.throwApplicationNotFound();
    }

    this.logger.log(
      {
        event: 'application.notes.updated',
        organizationId,
        actorUserId: session.user.id,
        applicationId,
        hasNotes: Boolean(updated.notes),
      },
      'ApplicationsService',
    );

    return this.toResponse(updated);
  }

  private async assertActionAllowed(
    session: AuthenticatedSession,
    organizationId: string,
  ) {
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManageApplications(actor, session.user.id, organizationId);
  }

  private async getScopedActor(
    session: AuthenticatedSession,
    organizationId: string,
  ): Promise<ApplicationActorRecord> {
    const actor = await this.applicationsRepository.findActorMember(
      organizationId,
      session.user.id,
    );

    if (actor) {
      return actor;
    }

    this.logger.warn(
      {
        event: 'application.scope_forbidden',
        organizationId,
        actorUserId: session.user.id,
      },
      'ApplicationsService',
    );

    throw new ForbiddenException({
      code: 'ORGANIZATION_SCOPE_FORBIDDEN',
      message: 'User is not a member of the active organization',
    });
  }

  private assertCanManageApplications(
    actor: ApplicationActorRecord,
    actorUserId: string,
    organizationId: string,
  ) {
    if (APPLICATION_MANAGER_ROLES.has(actor.role)) {
      return;
    }

    this.logger.warn(
      {
        event: 'application.manage_forbidden',
        organizationId,
        actorUserId,
        actorRole: actor.role,
      },
      'ApplicationsService',
    );

    throw new ForbiddenException({
      code: 'APPLICATION_MANAGEMENT_FORBIDDEN',
      message: 'Only organization owners and recruiters can manage applications',
    });
  }

  private async assertReferencesExist(
    organizationId: string,
    jobId: string,
    candidateId: string,
  ) {
    const references = await this.applicationsRepository.findReferenceStatus(
      organizationId,
      jobId,
      candidateId,
    );

    if (!references.jobExists) {
      throw new NotFoundException({
        code: 'JOB_NOT_FOUND',
        message: 'Organization job was not found',
      });
    }

    if (!references.candidateExists) {
      throw new NotFoundException({
        code: 'CANDIDATE_NOT_FOUND',
        message: 'Organization candidate was not found',
      });
    }
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

  private mapApplicationConflict(error: unknown): never | void {
    const constraint = (error as { constraint?: unknown }).constraint;

    if (constraint === 'application_job_candidate_uidx') {
      throw new ConflictException({
        code: 'APPLICATION_ALREADY_EXISTS',
        message: 'Candidate already has an application for this job',
      });
    }
  }

  private throwApplicationNotFound(): never {
    throw new NotFoundException({
      code: 'APPLICATION_NOT_FOUND',
      message: 'Organization application was not found',
    });
  }

  private toResponse(record: ApplicationRecord): ApplicationResponseDto {
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
}

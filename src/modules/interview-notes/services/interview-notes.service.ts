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
import { INTERVIEW_NOTE_MANAGER_ROLES } from '../domain/interview-note-permissions';
import type { CreateInterviewNoteDto } from '../dto/create-interview-note.dto';
import type { InterviewNoteResponseDto } from '../dto/interview-note-response.dto';
import type { UpdateInterviewNoteDto } from '../dto/update-interview-note.dto';
import {
  type InterviewNoteActorRecord,
  type InterviewNoteRecord,
  InterviewNotesRepository,
} from '../repositories/interview-notes.repository';

@Injectable()
export class InterviewNotesService {
  constructor(
    private readonly interviewNotesRepository: InterviewNotesRepository,
    @Inject(APP_LOGGER)
    private readonly logger: ApplicationLogger,
  ) {}

  async create(
    session: AuthenticatedSession,
    applicationId: string,
    dto: CreateInterviewNoteDto,
  ): Promise<InterviewNoteResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);

    const created = await this.interviewNotesRepository.create({
      organizationId,
      applicationId,
      actorUserId: session.user.id,
      content: this.trimContent(dto.content),
      rating: dto.rating ?? null,
      includeInAiContext: dto.includeInAiContext ?? false,
    });

    if (!created) {
      this.throwApplicationNotFound();
    }

    this.logger.log(
      {
        event: 'interview_note.created',
        organizationId,
        actorUserId: session.user.id,
        applicationId,
        interviewNoteId: created.id,
        hasRating: created.rating !== null,
        includeInAiContext: created.includeInAiContext,
      },
      'InterviewNotesService',
    );

    return this.toResponse(created);
  }

  async update(
    session: AuthenticatedSession,
    noteId: string,
    dto: UpdateInterviewNoteDto,
  ): Promise<InterviewNoteResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);

    const updated = await this.interviewNotesRepository.update({
      organizationId,
      noteId,
      actorUserId: session.user.id,
      content:
        dto.content === undefined ? undefined : this.trimContent(dto.content),
      rating: dto.rating,
      includeInAiContext: dto.includeInAiContext,
    });

    if (!updated) {
      this.throwInterviewNoteNotFound();
    }

    this.logger.log(
      {
        event: 'interview_note.updated',
        organizationId,
        actorUserId: session.user.id,
        applicationId: updated.applicationId,
        interviewNoteId: updated.id,
        hasRating: updated.rating !== null,
        includeInAiContext: updated.includeInAiContext,
      },
      'InterviewNotesService',
    );

    return this.toResponse(updated);
  }

  async listByApplication(
    session: AuthenticatedSession,
    applicationId: string,
  ): Promise<InterviewNoteResponseDto[]> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);

    const notes = await this.interviewNotesRepository.listByApplication(
      organizationId,
      applicationId,
    );

    if (!notes) {
      this.throwApplicationNotFound();
    }

    return notes.map((note) => this.toResponse(note));
  }

  private async assertActionAllowed(
    session: AuthenticatedSession,
    organizationId: string,
  ) {
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManageInterviewNotes(actor, session.user.id, organizationId);
  }

  private async getScopedActor(
    session: AuthenticatedSession,
    organizationId: string,
  ): Promise<InterviewNoteActorRecord> {
    const actor = await this.interviewNotesRepository.findActorMember(
      organizationId,
      session.user.id,
    );

    if (actor) {
      return actor;
    }

    this.logger.warn(
      {
        event: 'interview_note.scope_forbidden',
        organizationId,
        actorUserId: session.user.id,
      },
      'InterviewNotesService',
    );

    throw new ForbiddenException({
      code: 'ORGANIZATION_SCOPE_FORBIDDEN',
      message: 'User is not a member of the active organization',
    });
  }

  private assertCanManageInterviewNotes(
    actor: InterviewNoteActorRecord,
    actorUserId: string,
    organizationId: string,
  ) {
    if (INTERVIEW_NOTE_MANAGER_ROLES.has(actor.role)) {
      return;
    }

    this.logger.warn(
      {
        event: 'interview_note.manage_forbidden',
        organizationId,
        actorUserId,
        actorRole: actor.role,
      },
      'InterviewNotesService',
    );

    throw new ForbiddenException({
      code: 'INTERVIEW_NOTE_MANAGEMENT_FORBIDDEN',
      message:
        'Only organization owners and recruiters can manage interview notes',
    });
  }

  private trimContent(value: string) {
    const trimmed = value.trim();

    if (trimmed.length > 0) {
      return trimmed;
    }

    throw new BadRequestException({
      code: 'INTERVIEW_NOTE_CONTENT_EMPTY',
      message: 'Interview note content cannot be blank',
    });
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

  private throwInterviewNoteNotFound(): never {
    throw new NotFoundException({
      code: 'INTERVIEW_NOTE_NOT_FOUND',
      message: 'Organization interview note was not found',
    });
  }

  private toResponse(record: InterviewNoteRecord): InterviewNoteResponseDto {
    return {
      id: record.id,
      applicationId: record.applicationId,
      authorId: record.authorId,
      content: record.content,
      rating: record.rating ?? null,
      includeInAiContext: record.includeInAiContext,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

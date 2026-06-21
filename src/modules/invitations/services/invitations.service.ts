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
import {
  MEMBER_MANAGER_ROLES,
  type MemberRole,
} from '../../members/domain/member-role';
import { MembersService } from '../../members/services/members.service';
import {
  InvitationMemberAlreadyExistsError,
  PendingInvitationAlreadyExistsError,
} from '../domain/invitation-errors';
import {
  createInvitationExpiration,
  isInvitationExpired,
  normalizeInvitationEmail,
} from '../domain/invitation-rules';
import type { CreateInvitationDto } from '../dto/create-invitation.dto';
import type { InvitationResponseDto } from '../dto/invitation-response.dto';
import {
  type InvitationActorRecord,
  type InvitationRecord,
  InvitationsRepository,
} from '../repositories/invitations.repository';

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';
const MEMBER_ORG_USER_UNIQUE_CONSTRAINT = 'member_org_user_uidx';

interface DatabaseError {
  code?: string;
  constraint?: string;
}

const isDatabaseError = (error: unknown): error is DatabaseError =>
  typeof error === 'object' && error !== null;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly invitationsRepository: InvitationsRepository,
    private readonly membersService: MembersService,
    @Inject(APP_LOGGER)
    private readonly logger: ApplicationLogger,
  ) {}

  async create(
    session: AuthenticatedSession,
    dto: CreateInvitationDto,
  ): Promise<InvitationResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManageInvitations(actor, session.user.id, organizationId);
    await this.membersService.assertCanAddMember(organizationId);

    const now = new Date();

    try {
      const created = await this.invitationsRepository.create({
        organizationId,
        actorUserId: session.user.id,
        email: normalizeInvitationEmail(dto.email),
        role: dto.role ?? 'recruiter',
        expiresAt: createInvitationExpiration(now),
        now,
      });

      this.logger.log(
        {
          event: 'member.invited',
          organizationId,
          actorUserId: session.user.id,
          invitationId: created.id,
          role: created.role,
        },
        'InvitationsService',
      );

      return this.toResponse(created);
    } catch (error) {
      this.throwInvitationConflictIfNeeded(error);
      throw error;
    }
  }

  async resend(
    session: AuthenticatedSession,
    invitationId: string,
  ): Promise<InvitationResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManageInvitations(actor, session.user.id, organizationId);

    const target = await this.getTargetInvitation(organizationId, invitationId);
    this.assertPendingInvitation(target);

    const updated = await this.invitationsRepository.resend({
      organizationId,
      invitationId,
      actorUserId: session.user.id,
      expiresAt: createInvitationExpiration(),
    });

    if (!updated) {
      this.throwInvitationStateConflict();
    }

    this.logger.log(
      {
        event: 'member.invitation_resent',
        organizationId,
        actorUserId: session.user.id,
        invitationId,
        role: updated.role,
      },
      'InvitationsService',
    );

    return this.toResponse(updated);
  }

  async cancel(
    session: AuthenticatedSession,
    invitationId: string,
  ): Promise<InvitationResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManageInvitations(actor, session.user.id, organizationId);

    const target = await this.getTargetInvitation(organizationId, invitationId);
    this.assertPendingInvitation(target);

    const canceled = await this.invitationsRepository.cancel({
      organizationId,
      invitationId,
      actorUserId: session.user.id,
    });

    if (!canceled) {
      this.throwInvitationStateConflict();
    }

    this.logger.log(
      {
        event: 'member.invitation_canceled',
        organizationId,
        actorUserId: session.user.id,
        invitationId,
      },
      'InvitationsService',
    );

    return this.toResponse(canceled);
  }

  async accept(
    session: AuthenticatedSession,
    invitationId: string,
  ): Promise<InvitationResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    const target = await this.getTargetInvitation(organizationId, invitationId);

    this.assertInvitationBelongsToUser(target, session);
    this.assertPendingInvitation(target);
    this.assertInvitationNotExpired(target);
    await this.membersService.assertCanAddMember(organizationId);

    try {
      const accepted = await this.invitationsRepository.accept({
        organizationId,
        invitationId,
        userId: session.user.id,
        sessionToken: session.session.token,
        acceptedAt: new Date(),
      });

      if (!accepted) {
        this.throwInvitationStateConflict();
      }

      this.logger.log(
        {
          event: 'member.invitation_accepted',
          organizationId,
          actorUserId: session.user.id,
          invitationId,
          role: accepted.role,
        },
        'InvitationsService',
      );

      return this.toResponse(accepted);
    } catch (error) {
      this.throwInvitationConflictIfNeeded(error);
      throw error;
    }
  }

  private async getScopedActor(
    session: AuthenticatedSession,
    organizationId: string,
  ): Promise<InvitationActorRecord> {
    const actor = await this.invitationsRepository.findActorMember(
      organizationId,
      session.user.id,
    );

    if (actor) {
      return actor;
    }

    this.logger.warn(
      {
        event: 'invitation.scope_forbidden',
        organizationId,
        actorUserId: session.user.id,
      },
      'InvitationsService',
    );

    throw new ForbiddenException({
      code: 'ORGANIZATION_SCOPE_FORBIDDEN',
      message: 'User is not a member of the active organization',
    });
  }

  private async getTargetInvitation(
    organizationId: string,
    invitationId: string,
  ): Promise<InvitationRecord> {
    const target = await this.invitationsRepository.findById(
      organizationId,
      invitationId,
    );

    if (target) {
      return target;
    }

    throw new NotFoundException({
      code: 'INVITATION_NOT_FOUND',
      message: 'Organization invitation was not found',
    });
  }

  private assertCanManageInvitations(
    actor: InvitationActorRecord,
    actorUserId: string,
    organizationId: string,
  ) {
    if (MEMBER_MANAGER_ROLES.has(actor.role)) {
      return;
    }

    this.logger.warn(
      {
        event: 'invitation.manage_forbidden',
        organizationId,
        actorUserId,
        actorRole: actor.role,
      },
      'InvitationsService',
    );

    throw new ForbiddenException({
      code: 'INVITATION_MANAGEMENT_FORBIDDEN',
      message: 'Only organization owners can manage invitations',
    });
  }

  private assertInvitationBelongsToUser(
    invitationRecord: InvitationRecord,
    session: AuthenticatedSession,
  ) {
    if (
      normalizeInvitationEmail(invitationRecord.email) ===
      normalizeInvitationEmail(session.user.email)
    ) {
      return;
    }

    this.logger.warn(
      {
        event: 'invitation.accept_email_mismatch',
        organizationId: invitationRecord.organizationId,
        actorUserId: session.user.id,
        invitationId: invitationRecord.id,
      },
      'InvitationsService',
    );

    throw new ForbiddenException({
      code: 'INVITATION_EMAIL_MISMATCH',
      message: 'Authenticated user cannot accept this invitation',
    });
  }

  private assertPendingInvitation(invitationRecord: InvitationRecord) {
    if (invitationRecord.status === 'pending') {
      return;
    }

    throw new ConflictException({
      code: 'INVITATION_NOT_PENDING',
      message: 'Invitation is not pending',
    });
  }

  private assertInvitationNotExpired(invitationRecord: InvitationRecord) {
    if (!isInvitationExpired(invitationRecord.expiresAt)) {
      return;
    }

    throw new ConflictException({
      code: 'INVITATION_EXPIRED',
      message: 'Invitation has expired',
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

  private throwInvitationStateConflict(): never {
    throw new ConflictException({
      code: 'INVITATION_STATE_CONFLICT',
      message: 'Invitation state changed before the operation completed',
    });
  }

  private throwInvitationConflictIfNeeded(error: unknown): void {
    if (error instanceof PendingInvitationAlreadyExistsError) {
      throw new ConflictException({
        code: 'INVITATION_ALREADY_PENDING',
        message: 'A pending invitation already exists for this email',
      });
    }

    if (
      error instanceof InvitationMemberAlreadyExistsError ||
      this.isMemberUniqueViolation(error)
    ) {
      throw new ConflictException({
        code: 'INVITATION_MEMBER_ALREADY_EXISTS',
        message: 'Invited user is already an organization member',
      });
    }
  }

  private isMemberUniqueViolation(error: unknown) {
    return (
      isDatabaseError(error) &&
      error.code === POSTGRES_UNIQUE_VIOLATION_CODE &&
      error.constraint === MEMBER_ORG_USER_UNIQUE_CONSTRAINT
    );
  }

  private toResponse(invitationRecord: InvitationRecord): InvitationResponseDto {
    return {
      id: invitationRecord.id,
      email: invitationRecord.email,
      role: invitationRecord.role as MemberRole,
      status: invitationRecord.status,
      expiresAt: invitationRecord.expiresAt.toISOString(),
      createdAt: invitationRecord.createdAt.toISOString(),
      inviterId: invitationRecord.inviterId,
    };
  }
}

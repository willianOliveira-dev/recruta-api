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
  PlanLimitsService,
  type MembershipCapacity,
} from '../../subscription-plans/services/plan-limits.service';
import { LastOrganizationOwnerError } from '../domain/member-errors';
import {
  isOwnerRole,
  MEMBER_MANAGER_ROLES,
  type MemberRole,
} from '../domain/member-role';
import type {
  MemberResponseDto,
  MembersLimitResponseDto,
  MembersListResponseDto,
} from '../dto/member-response.dto';
import type { UpdateMemberRoleDto } from '../dto/update-member-role.dto';
import {
  type MemberRecord,
  MembersRepository,
} from '../repositories/members.repository';

@Injectable()
export class MembersService {
  constructor(
    private readonly membersRepository: MembersRepository,
    private readonly planLimitsService: PlanLimitsService,
    @Inject(APP_LOGGER)
    private readonly logger: ApplicationLogger,
  ) {}

  async listCurrent(
    session: AuthenticatedSession,
  ): Promise<MembersListResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.getScopedActor(session, organizationId);

    const [members, capacity] = await Promise.all([
      this.membersRepository.listByOrganization(organizationId),
      this.planLimitsService.getMembershipCapacity(organizationId),
    ]);

    return {
      members: members.map((record) => this.toResponse(record)),
      limit: this.toLimitResponse(capacity),
    };
  }

  async updateRole(
    session: AuthenticatedSession,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<MemberResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManageMembers(actor, session.user.id, organizationId);
    this.assertNotSelf(actor, memberId);

    const target = await this.getTargetMember(organizationId, memberId);
    await this.assertCanChangeOwnerRole(organizationId, target, dto.role);

    if (target.member.role === dto.role) {
      return this.toResponse(target);
    }

    const updated = await this.updateRoleSafely({
      organizationId,
      memberId,
      actorUserId: session.user.id,
      role: dto.role,
    });

    if (!updated) {
      this.throwMemberNotFound();
    }

    this.logger.log(
      {
        event: 'member.role_changed',
        organizationId,
        actorUserId: session.user.id,
        memberId,
        role: dto.role,
      },
      'MembersService',
    );

    return this.toResponse(updated);
  }

  async remove(
    session: AuthenticatedSession,
    memberId: string,
  ): Promise<MemberResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    const actor = await this.getScopedActor(session, organizationId);
    this.assertCanManageMembers(actor, session.user.id, organizationId);
    this.assertNotSelf(actor, memberId);

    const target = await this.getTargetMember(organizationId, memberId);
    await this.assertCanRemoveMember(organizationId, target);

    const removed = await this.removeSafely({
      organizationId,
      memberId,
      actorUserId: session.user.id,
    });

    if (!removed) {
      this.throwMemberNotFound();
    }

    this.logger.log(
      {
        event: 'member.removed',
        organizationId,
        actorUserId: session.user.id,
        memberId,
      },
      'MembersService',
    );

    return this.toResponse(removed);
  }

  async assertCanAddMember(organizationId: string): Promise<void> {
    await this.planLimitsService.assertCanAddMember(organizationId);
  }

  private async getScopedActor(
    session: AuthenticatedSession,
    organizationId: string,
  ): Promise<MemberRecord> {
    const actor = await this.membersRepository.findByUser(
      organizationId,
      session.user.id,
    );

    if (actor) {
      return actor;
    }

    this.logger.warn(
      {
        event: 'member.scope_forbidden',
        organizationId,
        actorUserId: session.user.id,
      },
      'MembersService',
    );

    throw new ForbiddenException({
      code: 'ORGANIZATION_SCOPE_FORBIDDEN',
      message: 'User is not a member of the active organization',
    });
  }

  private async getTargetMember(
    organizationId: string,
    memberId: string,
  ): Promise<MemberRecord> {
    const target = await this.membersRepository.findById(
      organizationId,
      memberId,
    );

    if (target) {
      return target;
    }

    this.throwMemberNotFound();
  }

  private async updateRoleSafely(input: {
    organizationId: string;
    memberId: string;
    actorUserId: string;
    role: MemberRole;
  }): Promise<MemberRecord | null> {
    try {
      return await this.membersRepository.updateRole(input);
    } catch (error) {
      this.throwLastOwnerConflictIfNeeded(
        error,
        'MEMBER_LAST_OWNER_ROLE_CHANGE_FORBIDDEN',
        'Cannot remove the last organization owner role',
      );

      throw error;
    }
  }

  private async removeSafely(input: {
    organizationId: string;
    memberId: string;
    actorUserId: string;
  }): Promise<MemberRecord | null> {
    try {
      return await this.membersRepository.remove(input);
    } catch (error) {
      this.throwLastOwnerConflictIfNeeded(
        error,
        'MEMBER_LAST_OWNER_REMOVAL_FORBIDDEN',
        'Cannot remove the last organization owner',
      );

      throw error;
    }
  }

  private assertCanManageMembers(
    actor: MemberRecord,
    actorUserId: string,
    organizationId: string,
  ) {
    if (MEMBER_MANAGER_ROLES.has(actor.member.role)) {
      return;
    }

    this.logger.warn(
      {
        event: 'member.manage_forbidden',
        organizationId,
        actorUserId,
        actorRole: actor.member.role,
      },
      'MembersService',
    );

    throw new ForbiddenException({
      code: 'MEMBER_MANAGEMENT_FORBIDDEN',
      message: 'Only organization owners can manage members',
    });
  }

  private assertNotSelf(actor: MemberRecord, memberId: string) {
    if (actor.member.id !== memberId) {
      return;
    }

    throw new ForbiddenException({
      code: 'MEMBER_SELF_MANAGEMENT_FORBIDDEN',
      message: 'Members cannot manage their own membership',
    });
  }

  private async assertCanChangeOwnerRole(
    organizationId: string,
    target: MemberRecord,
    nextRole: MemberRole,
  ): Promise<void> {
    if (!isOwnerRole(target.member.role) || isOwnerRole(nextRole)) {
      return;
    }

    await this.assertHasAnotherOwner(
      organizationId,
      'MEMBER_LAST_OWNER_ROLE_CHANGE_FORBIDDEN',
      'Cannot remove the last organization owner role',
    );
  }

  private async assertCanRemoveMember(
    organizationId: string,
    target: MemberRecord,
  ): Promise<void> {
    if (!isOwnerRole(target.member.role)) {
      return;
    }

    await this.assertHasAnotherOwner(
      organizationId,
      'MEMBER_LAST_OWNER_REMOVAL_FORBIDDEN',
      'Cannot remove the last organization owner',
    );
  }

  private async assertHasAnotherOwner(
    organizationId: string,
    code: string,
    message: string,
  ): Promise<void> {
    const ownerCount = await this.membersRepository.countOwners(organizationId);

    if (ownerCount > 1) {
      return;
    }

    throw new ConflictException({
      code,
      message,
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

  private throwMemberNotFound(): never {
    throw new NotFoundException({
      code: 'MEMBER_NOT_FOUND',
      message: 'Organization member was not found',
    });
  }

  private throwLastOwnerConflictIfNeeded(
    error: unknown,
    code: string,
    message: string,
  ): void {
    if (!(error instanceof LastOrganizationOwnerError)) {
      return;
    }

    throw new ConflictException({
      code,
      message,
    });
  }

  private toResponse(record: MemberRecord): MemberResponseDto {
    return {
      id: record.member.id,
      role: record.member.role,
      createdAt: record.member.createdAt.toISOString(),
      user: {
        id: record.user.id,
        name: record.user.name,
        email: record.user.email,
        image: record.user.image ?? null,
      },
    };
  }

  private toLimitResponse(
    capacity: MembershipCapacity,
  ): MembersLimitResponseDto {
    return {
      currentUsers: capacity.currentUsers,
      maxUsers: capacity.maxUsers,
      seatsRemaining:
        capacity.maxUsers === null
          ? null
          : Math.max(capacity.maxUsers - capacity.currentUsers, 0),
    };
  }
}

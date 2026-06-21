import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { ApplicationLogger } from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import { LastOrganizationOwnerError } from '../domain/member-errors';
import type { MemberRole } from '../domain/member-role';
import type { MembersRepository } from '../repositories/members.repository';

jest.mock('../repositories/members.repository', () => ({
  MembersRepository: class MembersRepository {},
}));

import { MembersService } from '../services/members.service';

interface RepositoryMock {
  findByUser: jest.Mock;
  findById: jest.Mock;
  listByOrganization: jest.Mock;
  getMembershipCapacity: jest.Mock;
  countOwners: jest.Mock;
  updateRole: jest.Mock;
  remove: jest.Mock;
}

interface LoggerMock {
  log: jest.Mock;
  warn: jest.Mock;
}

const organizationId = '01972194-7d9f-7000-9c9e-b2abdc1d88e0';
const actorUserId = '01972194-7d9f-7000-9c9e-b2abdc1d88de';
const actorMemberId = '01972194-7d9f-7000-9c9e-b2abdc1d88e1';
const targetUserId = '01972194-7d9f-7000-9c9e-b2abdc1d88e2';
const targetMemberId = '01972194-7d9f-7000-9c9e-b2abdc1d88e3';
const createdAt = new Date('2026-06-21T12:00:00.000Z');

const session: AuthenticatedSession = {
  user: {
    id: actorUserId,
    email: 'owner@recruta.test',
    name: 'Owner',
  },
  session: {
    id: '01972194-7d9f-7000-9c9e-b2abdc1d88df',
    token: 'session-token',
    activeOrganizationId: organizationId,
  },
};

const makeMember = (
  role: MemberRole,
  id = targetMemberId,
  userId = targetUserId,
) => ({
  member: {
    id,
    organizationId,
    userId,
    role,
    createdAt,
  },
  user: {
    id: userId,
    name: role === 'owner' ? 'Owner' : 'Recruiter',
    email: role === 'owner' ? 'owner@recruta.test' : 'recruiter@recruta.test',
    image: null,
  },
});

describe('MembersService', () => {
  let repository: RepositoryMock;
  let logger: LoggerMock;
  let service: MembersService;

  beforeEach(() => {
    repository = {
      findByUser: jest.fn(),
      findById: jest.fn(),
      listByOrganization: jest.fn(),
      getMembershipCapacity: jest.fn(),
      countOwners: jest.fn(),
      updateRole: jest.fn(),
      remove: jest.fn(),
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };
    service = new MembersService(
      repository as unknown as MembersRepository,
      logger as unknown as ApplicationLogger,
    );
  });

  it('rejects requests when no active organization is selected', async () => {
    await expect(
      service.listCurrent({
        ...session,
        session: { ...session.session, activeOrganizationId: null },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists current organization members with membership capacity', async () => {
    repository.findByUser.mockResolvedValue(
      makeMember('owner', actorMemberId, actorUserId),
    );
    repository.listByOrganization.mockResolvedValue([
      makeMember('owner', actorMemberId, actorUserId),
      makeMember('recruiter'),
    ]);
    repository.getMembershipCapacity.mockResolvedValue({
      currentUsers: 2,
      maxUsers: 3,
    });

    const response = await service.listCurrent(session);

    expect(response.limit).toEqual({
      currentUsers: 2,
      maxUsers: 3,
      seatsRemaining: 1,
    });
    expect(response.members).toHaveLength(2);
    expect(response.members[1]).toMatchObject({
      id: targetMemberId,
      role: 'recruiter',
      user: {
        id: targetUserId,
        email: 'recruiter@recruta.test',
      },
    });
  });

  it('rejects member management when the actor is not scoped to the active organization', async () => {
    repository.findByUser.mockResolvedValue(null);

    await expect(
      service.updateRole(session, targetMemberId, { role: 'admin' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows owners to change a member role', async () => {
    repository.findByUser.mockResolvedValue(
      makeMember('owner', actorMemberId, actorUserId),
    );
    repository.findById.mockResolvedValue(makeMember('recruiter'));
    repository.updateRole.mockResolvedValue(makeMember('admin'));

    const response = await service.updateRole(session, targetMemberId, {
      role: 'admin',
    });

    expect(response.role).toBe('admin');
    expect(repository.updateRole).toHaveBeenCalledWith({
      organizationId,
      memberId: targetMemberId,
      actorUserId,
      role: 'admin',
    });
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'member.role_changed',
        organizationId,
        actorUserId,
        memberId: targetMemberId,
      }),
      'MembersService',
    );
  });

  it('rejects member management from recruiters', async () => {
    repository.findByUser.mockResolvedValue(
      makeMember('recruiter', actorMemberId, actorUserId),
    );

    await expect(
      service.updateRole(session, targetMemberId, { role: 'admin' }),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.updateRole).not.toHaveBeenCalled();
  });

  it('prevents owners from changing their own role', async () => {
    repository.findByUser.mockResolvedValue(
      makeMember('owner', actorMemberId, actorUserId),
    );

    await expect(
      service.updateRole(session, actorMemberId, { role: 'recruiter' }),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.updateRole).not.toHaveBeenCalled();
  });

  it('prevents demoting the last owner', async () => {
    repository.findByUser.mockResolvedValue(
      makeMember('owner', actorMemberId, actorUserId),
    );
    repository.findById.mockResolvedValue(makeMember('owner'));
    repository.countOwners.mockResolvedValue(1);

    await expect(
      service.updateRole(session, targetMemberId, { role: 'recruiter' }),
    ).rejects.toThrow(ConflictException);
    expect(repository.updateRole).not.toHaveBeenCalled();
  });

  it('maps concurrent last-owner role changes to conflict responses', async () => {
    repository.findByUser.mockResolvedValue(
      makeMember('owner', actorMemberId, actorUserId),
    );
    repository.findById.mockResolvedValue(makeMember('owner'));
    repository.countOwners.mockResolvedValue(2);
    repository.updateRole.mockRejectedValue(new LastOrganizationOwnerError());

    await expect(
      service.updateRole(session, targetMemberId, { role: 'recruiter' }),
    ).rejects.toThrow(ConflictException);
  });

  it('removes a non-owner member and writes an operational log', async () => {
    repository.findByUser.mockResolvedValue(
      makeMember('owner', actorMemberId, actorUserId),
    );
    repository.findById.mockResolvedValue(makeMember('recruiter'));
    repository.remove.mockResolvedValue(makeMember('recruiter'));

    const response = await service.remove(session, targetMemberId);

    expect(response.id).toBe(targetMemberId);
    expect(repository.remove).toHaveBeenCalledWith({
      organizationId,
      memberId: targetMemberId,
      actorUserId,
    });
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'member.removed',
        organizationId,
        actorUserId,
        memberId: targetMemberId,
      }),
      'MembersService',
    );
  });

  it('prevents removing the last owner', async () => {
    repository.findByUser.mockResolvedValue(
      makeMember('owner', actorMemberId, actorUserId),
    );
    repository.findById.mockResolvedValue(makeMember('owner'));
    repository.countOwners.mockResolvedValue(1);

    await expect(service.remove(session, targetMemberId)).rejects.toThrow(
      ConflictException,
    );
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it('maps concurrent last-owner removals to conflict responses', async () => {
    repository.findByUser.mockResolvedValue(
      makeMember('owner', actorMemberId, actorUserId),
    );
    repository.findById.mockResolvedValue(makeMember('owner'));
    repository.countOwners.mockResolvedValue(2);
    repository.remove.mockRejectedValue(new LastOrganizationOwnerError());

    await expect(service.remove(session, targetMemberId)).rejects.toThrow(
      ConflictException,
    );
  });

  it('validates maxUsers before a future flow adds another member', async () => {
    repository.getMembershipCapacity.mockResolvedValue({
      currentUsers: 3,
      maxUsers: 3,
    });

    await expect(service.assertCanAddMember(organizationId)).rejects.toThrow(
      ForbiddenException,
    );
  });
});

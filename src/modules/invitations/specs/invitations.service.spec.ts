import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { ApplicationLogger } from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import type { MemberRole } from '../../members/domain/member-role';
import type { MembersService } from '../../members/services/members.service';
import {
  InvitationMemberAlreadyExistsError,
  PendingInvitationAlreadyExistsError,
} from '../domain/invitation-errors';
import type {
  InvitationActorRecord,
  InvitationRecord,
  InvitationsRepository,
} from '../repositories/invitations.repository';

jest.mock('../repositories/invitations.repository', () => ({
  InvitationsRepository: class InvitationsRepository {},
}));

jest.mock('../../members/services/members.service', () => ({
  MembersService: class MembersService {},
}));

import { InvitationsService } from '../services/invitations.service';

interface RepositoryMock {
  findActorMember: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  resend: jest.Mock;
  cancel: jest.Mock;
  accept: jest.Mock;
}

interface MembersServiceMock {
  assertCanAddMember: jest.Mock;
}

interface LoggerMock {
  log: jest.Mock;
  warn: jest.Mock;
}

const organizationId = '01972194-7d9f-7000-9c9e-b2abdc1d88e0';
const actorUserId = '01972194-7d9f-7000-9c9e-b2abdc1d88de';
const inviteeUserId = '01972194-7d9f-7000-9c9e-b2abdc1d88df';
const actorMemberId = '01972194-7d9f-7000-9c9e-b2abdc1d88e1';
const invitationId = '01972194-7d9f-7000-9c9e-b2abdc1d88e4';
const createdAt = new Date('2026-06-21T12:00:00.000Z');
const futureExpiration = new Date('2099-06-28T12:00:00.000Z');
const pastExpiration = new Date('2020-06-28T12:00:00.000Z');

const ownerSession: AuthenticatedSession = {
  user: {
    id: actorUserId,
    email: 'owner@recruta.test',
    name: 'Owner',
  },
  session: {
    id: '01972194-7d9f-7000-9c9e-b2abdc1d88ef',
    token: 'owner-session-token',
    activeOrganizationId: organizationId,
  },
};

const inviteeSession: AuthenticatedSession = {
  user: {
    id: inviteeUserId,
    email: 'Invitee@Recruta.TEST',
    name: 'Invitee',
  },
  session: {
    id: '01972194-7d9f-7000-9c9e-b2abdc1d88f0',
    token: 'invitee-session-token',
    activeOrganizationId: organizationId,
  },
};

const makeActor = (role: MemberRole): InvitationActorRecord => ({
  id: actorMemberId,
  userId: actorUserId,
  role,
});

const makeInvitation = (
  overrides: Partial<InvitationRecord> = {},
): InvitationRecord => ({
  id: invitationId,
  organizationId,
  email: 'invitee@recruta.test',
  role: 'recruiter',
  status: 'pending',
  expiresAt: futureExpiration,
  createdAt,
  inviterId: actorUserId,
  ...overrides,
});

describe('InvitationsService', () => {
  let repository: RepositoryMock;
  let membersService: MembersServiceMock;
  let logger: LoggerMock;
  let service: InvitationsService;

  beforeEach(() => {
    repository = {
      findActorMember: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      resend: jest.fn(),
      cancel: jest.fn(),
      accept: jest.fn(),
    };
    membersService = {
      assertCanAddMember: jest.fn(),
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };

    service = new InvitationsService(
      repository as unknown as InvitationsRepository,
      membersService as unknown as MembersService,
      logger as unknown as ApplicationLogger,
    );
  });

  it('rejects create requests when no active organization is selected', async () => {
    await expect(
      service.create(
        {
          ...ownerSession,
          session: { ...ownerSession.session, activeOrganizationId: null },
        },
        { email: 'invitee@recruta.test' },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('creates an invitation with normalized email and default recruiter role', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('owner'));
    membersService.assertCanAddMember.mockResolvedValue(undefined);
    repository.create.mockResolvedValue(makeInvitation());

    const response = await service.create(ownerSession, {
      email: ' Invitee@Recruta.TEST ',
    });

    expect(response).toMatchObject({
      id: invitationId,
      email: 'invitee@recruta.test',
      role: 'recruiter',
      status: 'pending',
    });
    expect(membersService.assertCanAddMember).toHaveBeenCalledWith(
      organizationId,
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        actorUserId,
        email: 'invitee@recruta.test',
        role: 'recruiter',
        expiresAt: expect.any(Date),
        now: expect.any(Date),
      }),
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'member.invited',
        organizationId,
        actorUserId,
        invitationId,
        role: 'recruiter',
      }),
      'InvitationsService',
    );
    expect(logger.log.mock.calls[0][0]).not.toHaveProperty('email');
  });

  it('rejects invitation management from recruiters', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('recruiter'));

    await expect(
      service.create(ownerSession, { email: 'invitee@recruta.test' }),
    ).rejects.toThrow(ForbiddenException);

    expect(membersService.assertCanAddMember).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('maps duplicate pending invitations to conflict responses', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('owner'));
    membersService.assertCanAddMember.mockResolvedValue(undefined);
    repository.create.mockRejectedValue(new PendingInvitationAlreadyExistsError());

    await expect(
      service.create(ownerSession, { email: 'invitee@recruta.test' }),
    ).rejects.toThrow(ConflictException);
  });

  it('maps already-member invitations to conflict responses', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('owner'));
    membersService.assertCanAddMember.mockResolvedValue(undefined);
    repository.create.mockRejectedValue(new InvitationMemberAlreadyExistsError());

    await expect(
      service.create(ownerSession, { email: 'invitee@recruta.test' }),
    ).rejects.toThrow(ConflictException);
  });

  it('resends pending invitations with a new expiration', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('owner'));
    repository.findById.mockResolvedValue(makeInvitation());
    repository.resend.mockResolvedValue(
      makeInvitation({ expiresAt: new Date('2099-07-01T12:00:00.000Z') }),
    );

    const response = await service.resend(ownerSession, invitationId);

    expect(response.expiresAt).toBe('2099-07-01T12:00:00.000Z');
    expect(repository.resend).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        invitationId,
        actorUserId,
        expiresAt: expect.any(Date),
      }),
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'member.invitation_resent',
        invitationId,
      }),
      'InvitationsService',
    );
  });

  it('cancels pending invitations', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('owner'));
    repository.findById.mockResolvedValue(makeInvitation());
    repository.cancel.mockResolvedValue(makeInvitation({ status: 'canceled' }));

    const response = await service.cancel(ownerSession, invitationId);

    expect(response.status).toBe('canceled');
    expect(repository.cancel).toHaveBeenCalledWith({
      organizationId,
      invitationId,
      actorUserId,
    });
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'member.invitation_canceled',
        invitationId,
      }),
      'InvitationsService',
    );
  });

  it('rejects resend when the invitation is no longer pending', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('owner'));
    repository.findById.mockResolvedValue(makeInvitation({ status: 'accepted' }));

    await expect(service.resend(ownerSession, invitationId)).rejects.toThrow(
      ConflictException,
    );
    expect(repository.resend).not.toHaveBeenCalled();
  });

  it('accepts a matching pending invitation without requiring current membership', async () => {
    repository.findById.mockResolvedValue(makeInvitation());
    membersService.assertCanAddMember.mockResolvedValue(undefined);
    repository.accept.mockResolvedValue(makeInvitation({ status: 'accepted' }));

    const response = await service.accept(inviteeSession, invitationId);

    expect(response.status).toBe('accepted');
    expect(repository.findActorMember).not.toHaveBeenCalled();
    expect(membersService.assertCanAddMember).toHaveBeenCalledWith(
      organizationId,
    );
    expect(repository.accept).toHaveBeenCalledWith({
      organizationId,
      invitationId,
      userId: inviteeUserId,
      sessionToken: 'invitee-session-token',
      acceptedAt: expect.any(Date),
    });
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'member.invitation_accepted',
        invitationId,
        role: 'recruiter',
      }),
      'InvitationsService',
    );
  });

  it('rejects invitation acceptance when the authenticated email does not match', async () => {
    repository.findById.mockResolvedValue(
      makeInvitation({ email: 'other@recruta.test' }),
    );

    await expect(service.accept(inviteeSession, invitationId)).rejects.toThrow(
      ForbiddenException,
    );
    expect(membersService.assertCanAddMember).not.toHaveBeenCalled();
    expect(repository.accept).not.toHaveBeenCalled();
  });

  it('rejects expired invitations before checking plan capacity', async () => {
    repository.findById.mockResolvedValue(
      makeInvitation({ expiresAt: pastExpiration }),
    );

    await expect(service.accept(inviteeSession, invitationId)).rejects.toThrow(
      ConflictException,
    );
    expect(membersService.assertCanAddMember).not.toHaveBeenCalled();
    expect(repository.accept).not.toHaveBeenCalled();
  });

  it('maps already-member acceptance races to conflict responses', async () => {
    repository.findById.mockResolvedValue(makeInvitation());
    membersService.assertCanAddMember.mockResolvedValue(undefined);
    repository.accept.mockRejectedValue(new InvitationMemberAlreadyExistsError());

    await expect(service.accept(inviteeSession, invitationId)).rejects.toThrow(
      ConflictException,
    );
  });
});

import { ForbiddenException } from '@nestjs/common';
import type { ApplicationLogger } from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import type { InterviewNotesRepository } from '../repositories/interview-notes.repository';

jest.mock('../repositories/interview-notes.repository', () => ({
  InterviewNotesRepository: class InterviewNotesRepository {},
}));

import { InterviewNotesService } from '../services/interview-notes.service';

interface InterviewNotesRepositoryMock {
  findActorMember: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  listByApplication: jest.Mock;
}

interface LoggerMock {
  log: jest.Mock;
  warn: jest.Mock;
}

const organizationId = '01972194-7d9f-7000-9c9e-b2abdc1d88e0';
const actorUserId = '01972194-7d9f-7000-9c9e-b2abdc1d88de';
const actorMemberId = '01972194-7d9f-7000-9c9e-b2abdc1d88e1';
const applicationId = '01972194-7d9f-7000-9c9e-b2abdc1d9002';
const noteId = '01972194-7d9f-7000-9c9e-b2abdc1d9004';
const now = new Date('2026-06-24T12:00:00.000Z');

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

const makeActor = (role: 'owner' | 'recruiter' | 'member' = 'owner') => ({
  id: actorMemberId,
  userId: actorUserId,
  role,
});

const makeNote = (includeInAiContext = false) => ({
  id: noteId,
  applicationId,
  authorId: actorUserId,
  content: 'Sensitive interview evidence',
  rating: 4,
  includeInAiContext,
  createdAt: now,
  updatedAt: now,
});

describe('InterviewNotesService', () => {
  let repository: InterviewNotesRepositoryMock;
  let logger: LoggerMock;
  let service: InterviewNotesService;

  beforeEach(() => {
    repository = {
      findActorMember: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      listByApplication: jest.fn(),
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };
    service = new InterviewNotesService(
      repository as unknown as InterviewNotesRepository,
      logger as unknown as ApplicationLogger,
    );
  });

  it('creates a note with trimmed evidence and AI context flag', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('recruiter'));
    repository.create.mockResolvedValue(makeNote(true));

    const response = await service.create(session, applicationId, {
      content: '  Strong backend evidence  ',
      rating: 4,
      includeInAiContext: true,
    });

    expect(response.includeInAiContext).toBe(true);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        applicationId,
        actorUserId,
        content: 'Strong backend evidence',
        rating: 4,
        includeInAiContext: true,
      }),
    );
  });

  it('does not log sensitive interview note content', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('owner'));
    repository.create.mockResolvedValue(makeNote());

    await service.create(session, applicationId, {
      content: 'Sensitive interview evidence',
    });

    expect(logger.log).toHaveBeenCalledWith(
      expect.not.objectContaining({
        content: expect.any(String),
      }),
      'InterviewNotesService',
    );
  });

  it('rejects note creation from non-manager members', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('member'));

    await expect(
      service.create(session, applicationId, {
        content: 'Valid note',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.create).not.toHaveBeenCalled();
  });
});

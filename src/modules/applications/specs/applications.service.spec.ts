import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { ApplicationLogger } from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import type { ApplicationsRepository } from '../repositories/applications.repository';

jest.mock('../repositories/applications.repository', () => ({
  ApplicationsRepository: class ApplicationsRepository {},
}));

import { ApplicationsService } from '../services/applications.service';

interface ApplicationsRepositoryMock {
  findActorMember: jest.Mock;
  findReferenceStatus: jest.Mock;
  create: jest.Mock;
  list: jest.Mock;
  updateNotes: jest.Mock;
}

interface LoggerMock {
  log: jest.Mock;
  warn: jest.Mock;
}

const organizationId = '01972194-7d9f-7000-9c9e-b2abdc1d88e0';
const actorUserId = '01972194-7d9f-7000-9c9e-b2abdc1d88de';
const actorMemberId = '01972194-7d9f-7000-9c9e-b2abdc1d88e1';
const jobId = '01972194-7d9f-7000-9c9e-b2abdc1d9000';
const candidateId = '01972194-7d9f-7000-9c9e-b2abdc1d9001';
const applicationId = '01972194-7d9f-7000-9c9e-b2abdc1d9002';
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

const makeApplication = () => ({
  id: applicationId,
  organizationId,
  jobId,
  candidateId,
  stage: 'applied' as const,
  stageEnteredAt: now,
  aiScore: null,
  aiSummary: null,
  notes: null,
  statusToken: null,
  createdAt: now,
  updatedAt: now,
});

describe('ApplicationsService', () => {
  let repository: ApplicationsRepositoryMock;
  let logger: LoggerMock;
  let service: ApplicationsService;

  beforeEach(() => {
    repository = {
      findActorMember: jest.fn(),
      findReferenceStatus: jest.fn(),
      create: jest.fn(),
      list: jest.fn(),
      updateNotes: jest.fn(),
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };
    service = new ApplicationsService(
      repository as unknown as ApplicationsRepository,
      logger as unknown as ApplicationLogger,
    );
  });

  it('creates an application after validating actor and scoped references', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('recruiter'));
    repository.findReferenceStatus.mockResolvedValue({
      jobExists: true,
      candidateExists: true,
    });
    repository.create.mockResolvedValue(makeApplication());

    const response = await service.create(session, jobId, candidateId, {
      notes: '  Initial note  ',
    });

    expect(response.stage).toBe('applied');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        jobId,
        candidateId,
        actorUserId,
        notes: 'Initial note',
      }),
    );
  });

  it('rejects application creation from non-manager members before reference lookup', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('member'));

    await expect(
      service.create(session, jobId, candidateId, {}),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.findReferenceStatus).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('maps duplicate job and candidate pairs to a stable conflict code', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('owner'));
    repository.findReferenceStatus.mockResolvedValue({
      jobExists: true,
      candidateExists: true,
    });
    repository.create.mockRejectedValue({
      constraint: 'application_job_candidate_uidx',
    });

    await expect(
      service.create(session, jobId, candidateId, {}),
    ).rejects.toThrow(ConflictException);
  });

  it('updates notes without logging note content', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('recruiter'));
    repository.updateNotes.mockResolvedValue({
      ...makeApplication(),
      notes: 'Sensitive note',
    });

    await service.updateNotes(session, applicationId, {
      notes: 'Sensitive note',
    });

    expect(logger.log).toHaveBeenCalledWith(
      expect.not.objectContaining({
        notes: expect.any(String),
      }),
      'ApplicationsService',
    );
  });
});

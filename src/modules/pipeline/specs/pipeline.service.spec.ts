import { ForbiddenException } from '@nestjs/common';
import type { ApplicationLogger } from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import type { PipelineRepository } from '../repositories/pipeline.repository';

jest.mock('../repositories/pipeline.repository', () => ({
  PipelineRepository: class PipelineRepository {},
}));

import { PipelineService } from '../services/pipeline.service';

interface PipelineRepositoryMock {
  findActorMember: jest.Mock;
  moveStage: jest.Mock;
  listHistory: jest.Mock;
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
const historyId = '01972194-7d9f-7000-9c9e-b2abdc1d9003';
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

const makeApplication = (stage: 'applied' | 'screening' = 'screening') => ({
  id: applicationId,
  organizationId,
  jobId,
  candidateId,
  stage,
  stageEnteredAt: now,
  aiScore: null,
  aiSummary: null,
  notes: null,
  statusToken: null,
  createdAt: now,
  updatedAt: now,
});

describe('PipelineService', () => {
  let repository: PipelineRepositoryMock;
  let logger: LoggerMock;
  let service: PipelineService;

  beforeEach(() => {
    repository = {
      findActorMember: jest.fn(),
      moveStage: jest.fn(),
      listHistory: jest.fn(),
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };
    service = new PipelineService(
      repository as unknown as PipelineRepository,
      logger as unknown as ApplicationLogger,
    );
  });

  it('moves application stage and records safe log metadata', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('recruiter'));
    repository.moveStage.mockResolvedValue({
      application: makeApplication('screening'),
      history: {
        id: historyId,
        applicationId,
        fromStage: 'applied',
        toStage: 'screening',
        movedBy: actorUserId,
        reason: 'Sensitive reason',
        createdAt: now,
      },
    });

    const response = await service.moveStage(session, applicationId, {
      stage: 'screening',
      reason: 'Sensitive reason',
    });

    expect(response.stage).toBe('screening');
    expect(repository.moveStage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        applicationId,
        actorUserId,
        toStage: 'screening',
        reason: 'Sensitive reason',
      }),
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.not.objectContaining({
        reason: expect.any(String),
      }),
      'PipelineService',
    );
  });

  it('rejects stage movement from non-manager members', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('member'));

    await expect(
      service.moveStage(session, applicationId, { stage: 'screening' }),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.moveStage).not.toHaveBeenCalled();
  });
});

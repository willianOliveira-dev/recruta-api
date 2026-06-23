import { ForbiddenException } from '@nestjs/common';
import type { ApplicationLogger } from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import type { PlanLimitsService } from '../../subscription-plans/services/plan-limits.service';
import type { CreateJobDto } from '../dto/create-job.dto';
import type { JobsRepository } from '../repositories/jobs.repository';

jest.mock('../repositories/jobs.repository', () => ({
  JobsRepository: class JobsRepository {},
}));

jest.mock('../../subscription-plans/services/plan-limits.service', () => ({
  PlanLimitsService: class PlanLimitsService {},
}));

import { JobsService } from '../services/jobs.service';

interface JobsRepositoryMock {
  findActorMember: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  transitionStatus: jest.Mock;
  replaceSkills: jest.Mock;
}

interface PlanLimitsServiceMock {
  assertCanPublishJob: jest.Mock;
}

interface LoggerMock {
  log: jest.Mock;
  warn: jest.Mock;
}

const organizationId = '01972194-7d9f-7000-9c9e-b2abdc1d88e0';
const actorUserId = '01972194-7d9f-7000-9c9e-b2abdc1d88de';
const actorMemberId = '01972194-7d9f-7000-9c9e-b2abdc1d88e1';
const jobId = '01972194-7d9f-7000-9c9e-b2abdc1d9000';
const now = new Date('2026-06-22T12:00:00.000Z');

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

const createJobDto: CreateJobDto = {
  title: 'Backend Engineer',
  area: 'Engineering',
  seniority: 'senior',
  workMode: 'remote',
  contractType: 'clt',
};

const makeActor = (role: 'owner' | 'recruiter' | 'member' = 'owner') => ({
  id: actorMemberId,
  userId: actorUserId,
  role,
});

const makeJob = (status: 'draft' | 'published' = 'draft') => ({
  job: {
    id: jobId,
    organizationId,
    recruiterId: actorUserId,
    title: 'Backend Engineer',
    area: 'Engineering',
    department: null,
    seniority: 'senior',
    workMode: 'remote',
    locationCity: null,
    locationState: null,
    locationCountry: null,
    contractType: 'clt',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: 'BRL',
    summary: null,
    responsibilities: null,
    requirements: null,
    niceToHave: null,
    benefits: null,
    vacanciesCount: 1,
    appliesUntil: null,
    maxApplicants: null,
    status,
    createdAt: now,
    updatedAt: now,
  },
  skills: [],
});

describe('JobsService', () => {
  let repository: JobsRepositoryMock;
  let planLimitsService: PlanLimitsServiceMock;
  let logger: LoggerMock;
  let service: JobsService;

  beforeEach(() => {
    repository = {
      findActorMember: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      transitionStatus: jest.fn(),
      replaceSkills: jest.fn(),
    };
    planLimitsService = {
      assertCanPublishJob: jest.fn(),
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };
    service = new JobsService(
      repository as unknown as JobsRepository,
      planLimitsService as unknown as PlanLimitsService,
      logger as unknown as ApplicationLogger,
    );
  });

  it('creates job drafts without consuming published job limit', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('recruiter'));
    repository.create.mockResolvedValue(makeJob('draft'));

    const response = await service.create(session, createJobDto);

    expect(response.status).toBe('draft');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        recruiterId: actorUserId,
        status: 'draft',
      }),
    );
    expect(planLimitsService.assertCanPublishJob).not.toHaveBeenCalled();
  });

  it('validates plan capacity before publishing a job', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('owner'));
    repository.findById.mockResolvedValue(makeJob('draft'));
    repository.transitionStatus.mockResolvedValue(makeJob('published'));

    const response = await service.publish(session, jobId);

    expect(response.status).toBe('published');
    expect(planLimitsService.assertCanPublishJob).toHaveBeenCalledWith(
      organizationId,
    );
    expect(repository.transitionStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        jobId,
        status: 'published',
      }),
    );
  });

  it('rejects job management from non-manager members before plan validation', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('member'));

    await expect(service.publish(session, jobId)).rejects.toThrow(
      ForbiddenException,
    );
    expect(planLimitsService.assertCanPublishJob).not.toHaveBeenCalled();
    expect(repository.transitionStatus).not.toHaveBeenCalled();
  });
});

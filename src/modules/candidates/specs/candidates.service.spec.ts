import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ApplicationLogger } from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import type { PlanLimitsService } from '../../subscription-plans/services/plan-limits.service';
import type { CandidatesRepository } from '../repositories/candidates.repository';

jest.mock('../repositories/candidates.repository', () => ({
  CandidatesRepository: class CandidatesRepository {},
}));

jest.mock('../../subscription-plans/services/plan-limits.service', () => ({
  PlanLimitsService: class PlanLimitsService {},
}));

import { CandidatesService } from '../services/candidates.service';

interface CandidatesRepositoryMock {
  findActorMember: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  updateResume: jest.Mock;
  replaceSkills: jest.Mock;
  replaceExperiences: jest.Mock;
}

interface PlanLimitsServiceMock {
  assertCanCreateCandidate: jest.Mock;
}

interface LoggerMock {
  log: jest.Mock;
  warn: jest.Mock;
}

const organizationId = '01972194-7d9f-7000-9c9e-b2abdc1d88e0';
const actorUserId = '01972194-7d9f-7000-9c9e-b2abdc1d88de';
const actorMemberId = '01972194-7d9f-7000-9c9e-b2abdc1d88e1';
const candidateId = '01972194-7d9f-7000-9c9e-b2abdc1d9000';
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

const makeActor = (role: 'owner' | 'recruiter' | 'member' = 'owner') => ({
  id: actorMemberId,
  userId: actorUserId,
  role,
});

const makeCandidate = () => ({
  candidate: {
    id: candidateId,
    organizationId,
    fullName: 'Ana Souza',
    email: 'ana@example.com',
    phone: null,
    documentCpf: '12345678909',
    birthDate: null,
    city: null,
    state: null,
    country: null,
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
    resumeUrl: null,
    resumeText: null,
    workModePreference: null,
    availability: null,
    salaryExpectation: null,
    salaryCurrency: 'BRL',
    seniority: null,
    yearsOfExperience: null,
    educationDegree: null,
    educationInstitution: null,
    educationYear: null,
    createdAt: now,
    updatedAt: now,
  },
  skills: [],
  experiences: [],
});

describe('CandidatesService', () => {
  let repository: CandidatesRepositoryMock;
  let planLimitsService: PlanLimitsServiceMock;
  let logger: LoggerMock;
  let service: CandidatesService;

  beforeEach(() => {
    repository = {
      findActorMember: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateResume: jest.fn(),
      replaceSkills: jest.fn(),
      replaceExperiences: jest.fn(),
    };
    planLimitsService = {
      assertCanCreateCandidate: jest.fn(),
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };
    service = new CandidatesService(
      repository as unknown as CandidatesRepository,
      planLimitsService as unknown as PlanLimitsService,
      logger as unknown as ApplicationLogger,
    );
  });

  it('validates monthly candidate limit before creating a candidate', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('recruiter'));
    repository.create.mockResolvedValue(makeCandidate());

    await service.create(session, {
      fullName: 'Ana Souza',
      email: 'ANA@EXAMPLE.COM',
      documentCpf: '123.456.789-09',
    });

    expect(planLimitsService.assertCanCreateCandidate).toHaveBeenCalledWith(
      organizationId,
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        email: 'ana@example.com',
        documentCpf: '12345678909',
      }),
    );
  });

  it('rejects candidate creation from non-manager members before plan validation', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('member'));

    await expect(
      service.create(session, {
        fullName: 'Ana Souza',
        email: 'ana@example.com',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(planLimitsService.assertCanCreateCandidate).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects invalid CPF values before persistence', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('owner'));

    await expect(
      service.create(session, {
        fullName: 'Ana Souza',
        email: 'ana@example.com',
        documentCpf: '123',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('updates candidate resume without logging raw resume content', async () => {
    repository.findActorMember.mockResolvedValue(makeActor('recruiter'));
    repository.updateResume.mockResolvedValue(makeCandidate());

    await service.updateResume(session, candidateId, {
      resumeText: 'Sensitive resume text',
    });

    expect(repository.updateResume).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        candidateId,
        resumeText: 'Sensitive resume text',
      }),
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.not.objectContaining({
        resumeText: expect.any(String),
      }),
      'CandidatesService',
    );
  });
});

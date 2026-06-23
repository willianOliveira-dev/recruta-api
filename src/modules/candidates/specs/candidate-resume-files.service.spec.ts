import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ApplicationLogger } from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import type { PlanLimitsService } from '../../subscription-plans/services/plan-limits.service';
import type { CandidateResumeFilesRepository } from '../repositories/candidate-resume-files.repository';
import type { CandidatesRepository } from '../repositories/candidates.repository';
import type { CandidateResumeStorageService } from '../services/candidate-resume-storage.service';

jest.mock('../repositories/candidates.repository', () => ({
  CandidatesRepository: class CandidatesRepository {},
}));

jest.mock('../repositories/candidate-resume-files.repository', () => ({
  CandidateResumeFilesRepository: class CandidateResumeFilesRepository {},
}));

jest.mock('../services/candidate-resume-storage.service', () => ({
  CandidateResumeStorageService: class CandidateResumeStorageService {},
}));

jest.mock('../../subscription-plans/services/plan-limits.service', () => ({
  PlanLimitsService: class PlanLimitsService {},
}));

import { CandidateResumeFilesService } from '../services/candidate-resume-files.service';

interface CandidatesRepositoryMock {
  findActorMember: jest.Mock;
}

interface ResumeFilesRepositoryMock {
  candidateExists: jest.Mock;
  findById: jest.Mock;
  findCurrentUploaded: jest.Mock;
  createPending: jest.Mock;
  markUploaded: jest.Mock;
  markRejected: jest.Mock;
}

interface StorageServiceMock {
  bucket: string;
  maxFileSizeBytes: number;
  uploadUrlExpiresSeconds: number;
  accessUrlExpiresSeconds: number;
  createUploadUrl: jest.Mock;
  createAccessUrl: jest.Mock;
  getObjectMetadata: jest.Mock;
  getObjectPrefixBytes: jest.Mock;
  deleteObject: jest.Mock;
  moveObject: jest.Mock;
}

interface PlanLimitsServiceMock {
  getOrganizationLimitSnapshot: jest.Mock;
}

interface LoggerMock {
  log: jest.Mock;
  warn: jest.Mock;
}

const organizationId = '01972194-7d9f-7000-9c9e-b2abdc1d88e0';
const actorUserId = '01972194-7d9f-7000-9c9e-b2abdc1d88de';
const actorMemberId = '01972194-7d9f-7000-9c9e-b2abdc1d88e1';
const candidateId = '01972194-7d9f-7000-9c9e-b2abdc1d9000';
const resumeFileId = '01972194-7d9f-7000-9c9e-b2abdc1d9001';
const now = new Date('2026-06-23T12:00:00.000Z');

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

const makeResumeFile = (
  overrides: Partial<{
    status: 'pending' | 'uploaded' | 'rejected' | 'deleted';
    isCurrent: boolean;
    sizeBytes: number;
    uploadedAt: Date | null;
  }> = {},
) => ({
  id: resumeFileId,
  organizationId,
  candidateId,
  storageProvider: 'cloudflare_r2',
  bucket: 'recruta-resumes',
  objectKey: `pending/organizations/${organizationId}/candidates/${candidateId}/resumes/${resumeFileId}.pdf`,
  originalFileName: 'curriculo.pdf',
  mimeType: 'application/pdf',
  sizeBytes: overrides.sizeBytes ?? 1024,
  checksumSha256: null,
  status: overrides.status ?? 'pending',
  isCurrent: overrides.isCurrent ?? false,
  createdByUserId: actorUserId,
  uploadedAt: overrides.uploadedAt ?? null,
  rejectedAt: null,
  rejectionReason: null,
  createdAt: now,
  updatedAt: now,
});

describe('CandidateResumeFilesService', () => {
  let candidatesRepository: CandidatesRepositoryMock;
  let resumeFilesRepository: ResumeFilesRepositoryMock;
  let storageService: StorageServiceMock;
  let planLimitsService: PlanLimitsServiceMock;
  let logger: LoggerMock;
  let service: CandidateResumeFilesService;

  beforeEach(() => {
    candidatesRepository = {
      findActorMember: jest.fn().mockResolvedValue(makeActor('recruiter')),
    };
    resumeFilesRepository = {
      candidateExists: jest.fn().mockResolvedValue(true),
      findById: jest.fn(),
      findCurrentUploaded: jest.fn(),
      createPending: jest.fn().mockResolvedValue(makeResumeFile()),
      markUploaded: jest.fn().mockResolvedValue(
        makeResumeFile({
          status: 'uploaded',
          isCurrent: true,
          uploadedAt: now,
        }),
      ),
      markRejected: jest
        .fn()
        .mockResolvedValue(makeResumeFile({ status: 'rejected' })),
    };
    storageService = {
      bucket: 'recruta-resumes',
      maxFileSizeBytes: 10 * 1024 * 1024,
      uploadUrlExpiresSeconds: 600,
      accessUrlExpiresSeconds: 300,
      createUploadUrl: jest.fn().mockResolvedValue('https://upload.example'),
      createAccessUrl: jest.fn().mockResolvedValue('https://access.example'),
      getObjectMetadata: jest.fn().mockResolvedValue({
        contentType: 'application/pdf',
        contentLength: 1024,
      }),
      getObjectPrefixBytes: jest.fn().mockResolvedValue(Buffer.from('%PDF-')),
      deleteObject: jest.fn(),
      moveObject: jest.fn(),
    };
    planLimitsService = {
      getOrganizationLimitSnapshot: jest.fn().mockResolvedValue({
        plan: { code: 'plus' },
        hasActiveSubscription: true,
        usage: {},
      }),
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };
    service = new CandidateResumeFilesService(
      candidatesRepository as unknown as CandidatesRepository,
      resumeFilesRepository as unknown as CandidateResumeFilesRepository,
      storageService as unknown as CandidateResumeStorageService,
      planLimitsService as unknown as PlanLimitsService,
      logger as unknown as ApplicationLogger,
    );
  });

  it('creates a presigned upload URL only for PDF files within the configured size', async () => {
    const response = await service.requestUploadUrl(session, candidateId, {
      originalFileName: 'Ana Curriculo.pdf',
      sizeBytes: 1024,
    });

    expect(response.method).toBe('PUT');
    expect(response.headers).toEqual({ 'Content-Type': 'application/pdf' });
    expect(response.uploadUrl).toBe('https://upload.example');
    expect(resumeFilesRepository.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        candidateId,
        bucket: 'recruta-resumes',
        objectKey: expect.stringContaining('pending/organizations/'),
        originalFileName: 'Ana Curriculo.pdf',
        sizeBytes: 1024,
      }),
    );
  });

  it('rejects non-PDF file names before creating storage metadata', async () => {
    await expect(
      service.requestUploadUrl(session, candidateId, {
        originalFileName: 'curriculo.docx',
        sizeBytes: 1024,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(resumeFilesRepository.createPending).not.toHaveBeenCalled();
    expect(storageService.createUploadUrl).not.toHaveBeenCalled();
  });

  it('rejects files larger than the configured maximum before signing upload', async () => {
    await expect(
      service.requestUploadUrl(session, candidateId, {
        originalFileName: 'curriculo.pdf',
        sizeBytes: storageService.maxFileSizeBytes + 1,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(resumeFilesRepository.createPending).not.toHaveBeenCalled();
    expect(storageService.createUploadUrl).not.toHaveBeenCalled();
  });

  it('rejects resume file actions when the organization has no active subscription', async () => {
    planLimitsService.getOrganizationLimitSnapshot.mockResolvedValue({
      plan: null,
      hasActiveSubscription: false,
      usage: {},
    });

    await expect(
      service.requestUploadUrl(session, candidateId, {
        originalFileName: 'curriculo.pdf',
        sizeBytes: 1024,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(resumeFilesRepository.createPending).not.toHaveBeenCalled();
  });

  it('confirms an uploaded PDF when storage metadata matches the requested file', async () => {
    resumeFilesRepository.findById.mockResolvedValue(makeResumeFile());

    const response = await service.confirmUpload(
      session,
      candidateId,
      resumeFileId,
    );

    expect(response.status).toBe('uploaded');
    expect(storageService.getObjectMetadata).toHaveBeenCalledWith(
      expect.stringContaining(`${resumeFileId}.pdf`),
    );
    expect(resumeFilesRepository.markUploaded).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        candidateId,
        resumeFileId,
        objectKey: expect.stringContaining(`resumes/${resumeFileId}.pdf`),
      }),
    );
    expect(resumeFilesRepository.markUploaded).toHaveBeenCalledWith(
      expect.not.objectContaining({
        objectKey: expect.stringContaining('pending/'),
      }),
    );
    expect(storageService.moveObject).toHaveBeenCalledWith({
      sourceObjectKey: expect.stringContaining('pending/organizations/'),
      targetObjectKey: expect.stringContaining(
        `organizations/${organizationId}/candidates/${candidateId}/resumes/${resumeFileId}.pdf`,
      ),
    });
  });

  it('rejects and deletes uploaded objects that are not PDFs', async () => {
    resumeFilesRepository.findById.mockResolvedValue(makeResumeFile());
    storageService.getObjectMetadata.mockResolvedValue({
      contentType: 'application/msword',
      contentLength: 1024,
    });

    await expect(
      service.confirmUpload(session, candidateId, resumeFileId),
    ).rejects.toThrow(BadRequestException);

    expect(storageService.deleteObject).toHaveBeenCalledWith(
      expect.stringContaining(`${resumeFileId}.pdf`),
    );
    expect(resumeFilesRepository.markRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'invalid_content_type',
      }),
    );
  });

  it('rejects and deletes uploaded objects that do not start with the PDF signature', async () => {
    resumeFilesRepository.findById.mockResolvedValue(makeResumeFile());
    storageService.getObjectPrefixBytes.mockResolvedValue(Buffer.from('not-p'));

    await expect(
      service.confirmUpload(session, candidateId, resumeFileId),
    ).rejects.toThrow(BadRequestException);

    expect(storageService.deleteObject).toHaveBeenCalledWith(
      expect.stringContaining(`${resumeFileId}.pdf`),
    );
    expect(resumeFilesRepository.markRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'invalid_pdf_signature',
      }),
    );
  });

  it('creates a temporary access URL for the current uploaded resume file', async () => {
    resumeFilesRepository.findCurrentUploaded.mockResolvedValue(
      makeResumeFile({ status: 'uploaded', isCurrent: true, uploadedAt: now }),
    );

    const response = await service.createCurrentAccessUrl(
      session,
      candidateId,
      'inline',
    );

    expect(response.method).toBe('GET');
    expect(response.accessUrl).toBe('https://access.example');
    expect(storageService.createAccessUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        disposition: 'inline',
      }),
    );
  });
});

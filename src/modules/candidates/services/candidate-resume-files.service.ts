import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  APP_LOGGER,
  type ApplicationLogger,
} from '../../../common/logger/logger.tokens';
import type { AuthenticatedSession } from '../../auth/types/authenticated-request';
import { CANDIDATE_MANAGER_ROLES } from '../domain/candidate-permissions';
import { CANDIDATE_RESUME_FILE_EVENT_TYPES } from '../domain/candidate-resume-file-events';
import {
  type CandidateResumeAccessUrlResponseDto,
  type CandidateResumeFileResponseDto,
  type CandidateResumeUploadUrlResponseDto,
  CANDIDATE_RESUME_PDF_MIME_TYPE,
  type RequestCandidateResumeUploadDto,
} from '../dto/candidate-resume-file.dto';
import { CandidatesRepository } from '../repositories/candidates.repository';
import {
  type CandidateResumeFileRecord,
  CandidateResumeFilesRepository,
} from '../repositories/candidate-resume-files.repository';
import { PlanLimitsService } from '../../subscription-plans/services/plan-limits.service';
import { CandidateResumeStorageService } from './candidate-resume-storage.service';

@Injectable()
export class CandidateResumeFilesService {
  constructor(
    private readonly candidatesRepository: CandidatesRepository,
    private readonly resumeFilesRepository: CandidateResumeFilesRepository,
    private readonly storageService: CandidateResumeStorageService,
    private readonly planLimitsService: PlanLimitsService,
    @Inject(APP_LOGGER)
    private readonly logger: ApplicationLogger,
  ) {}

  async requestUploadUrl(
    session: AuthenticatedSession,
    candidateId: string,
    dto: RequestCandidateResumeUploadDto,
  ): Promise<CandidateResumeUploadUrlResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);
    await this.assertActiveSubscription(organizationId);

    const originalFileName = this.normalizePdfFileName(dto.originalFileName);
    this.assertValidFileSize(dto.sizeBytes);
    await this.assertCandidateExists(organizationId, candidateId);

    const resumeFileId = randomUUID();
    const objectKey = this.buildPendingObjectKey({
      organizationId,
      candidateId,
      resumeFileId,
    });
    const bucket = this.storageService.bucket;
    const expiresAt = this.expiresAt(
      this.storageService.uploadUrlExpiresSeconds,
    );

    const file = await this.resumeFilesRepository.createPending({
      id: resumeFileId,
      organizationId,
      candidateId,
      actorUserId: session.user.id,
      bucket,
      objectKey,
      originalFileName,
      sizeBytes: dto.sizeBytes,
      checksumSha256: dto.checksumSha256?.toLowerCase() ?? null,
    });
    const uploadUrl = await this.storageService.createUploadUrl({ objectKey });

    this.logger.log(
      {
        event: CANDIDATE_RESUME_FILE_EVENT_TYPES.uploadRequested,
        organizationId,
        actorUserId: session.user.id,
        candidateId,
        resumeFileId: file.id,
        sizeBytes: file.sizeBytes,
      },
      'CandidateResumeFilesService',
    );

    return {
      file: this.toResponse(file),
      uploadUrl,
      method: 'PUT',
      headers: {
        'Content-Type': CANDIDATE_RESUME_PDF_MIME_TYPE,
      },
      expiresAt: expiresAt.toISOString(),
    };
  }

  async confirmUpload(
    session: AuthenticatedSession,
    candidateId: string,
    resumeFileId: string,
  ): Promise<CandidateResumeFileResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);
    await this.assertActiveSubscription(organizationId);

    const file = await this.getResumeFile(
      organizationId,
      candidateId,
      resumeFileId,
    );

    if (file.status === 'uploaded') {
      return this.toResponse(file);
    }

    if (file.status !== 'pending') {
      throw new BadRequestException({
        code: 'CANDIDATE_RESUME_FILE_NOT_PENDING',
        message: 'Only pending resume files can be confirmed',
      });
    }

    const metadata = await this.readUploadedObjectMetadata(file);
    const prefixBytes = await this.readUploadedObjectPrefixBytes(file);
    const rejectionReason = this.getRejectionReason(
      file,
      metadata,
      prefixBytes,
    );

    if (rejectionReason) {
      await this.rejectUploadedObject(session, file, rejectionReason);

      throw new BadRequestException({
        code: 'CANDIDATE_RESUME_FILE_REJECTED',
        reason: rejectionReason,
        message: 'Candidate resume file failed validation',
      });
    }

    const finalObjectKey = this.buildFinalObjectKey({
      organizationId,
      candidateId,
      resumeFileId,
    });
    await this.storageService.moveObject({
      sourceObjectKey: file.objectKey,
      targetObjectKey: finalObjectKey,
    });

    const updated = await this.resumeFilesRepository.markUploaded({
      organizationId,
      candidateId,
      resumeFileId,
      actorUserId: session.user.id,
      objectKey: finalObjectKey,
    });

    if (!updated) {
      this.throwResumeFileNotFound();
    }

    this.logger.log(
      {
        event: CANDIDATE_RESUME_FILE_EVENT_TYPES.uploaded,
        organizationId,
        actorUserId: session.user.id,
        candidateId,
        resumeFileId,
        sizeBytes: updated.sizeBytes,
      },
      'CandidateResumeFilesService',
    );

    return this.toResponse(updated);
  }

  async createCurrentAccessUrl(
    session: AuthenticatedSession,
    candidateId: string,
    disposition: 'inline' | 'attachment',
  ): Promise<CandidateResumeAccessUrlResponseDto> {
    const organizationId = this.getActiveOrganizationId(session);
    await this.assertActionAllowed(session, organizationId);
    await this.assertActiveSubscription(organizationId);

    const file = await this.resumeFilesRepository.findCurrentUploaded({
      organizationId,
      candidateId,
    });

    if (!file) {
      this.throwResumeFileNotFound();
    }

    const expiresAt = this.expiresAt(
      this.storageService.accessUrlExpiresSeconds,
    );
    const accessUrl = await this.storageService.createAccessUrl({
      objectKey: file.objectKey,
      originalFileName: this.sanitizeDownloadFileName(file.originalFileName),
      disposition,
    });

    this.logger.log(
      {
        event: CANDIDATE_RESUME_FILE_EVENT_TYPES.accessUrlCreated,
        organizationId,
        actorUserId: session.user.id,
        candidateId,
        resumeFileId: file.id,
        disposition,
      },
      'CandidateResumeFilesService',
    );

    return {
      file: this.toResponse(file),
      accessUrl,
      method: 'GET',
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async assertActionAllowed(
    session: AuthenticatedSession,
    organizationId: string,
  ) {
    const actor = await this.candidatesRepository.findActorMember(
      organizationId,
      session.user.id,
    );

    if (actor && CANDIDATE_MANAGER_ROLES.has(actor.role)) {
      return;
    }

    this.logger.warn(
      {
        event: 'candidate.resume_file.manage_forbidden',
        organizationId,
        actorUserId: session.user.id,
        actorRole: actor?.role ?? null,
      },
      'CandidateResumeFilesService',
    );

    throw new ForbiddenException({
      code: 'CANDIDATE_RESUME_FILE_MANAGEMENT_FORBIDDEN',
      message:
        'Only organization owners and recruiters can manage candidate resume files',
    });
  }

  private async assertActiveSubscription(organizationId: string) {
    const snapshot =
      await this.planLimitsService.getOrganizationLimitSnapshot(organizationId);

    if (snapshot.hasActiveSubscription) {
      return;
    }

    throw new ForbiddenException({
      code: 'ORGANIZATION_SUBSCRIPTION_REQUIRED',
      message: 'Active subscription plan is required',
    });
  }

  private async assertCandidateExists(
    organizationId: string,
    candidateId: string,
  ) {
    const exists = await this.resumeFilesRepository.candidateExists(
      organizationId,
      candidateId,
    );

    if (exists) {
      return;
    }

    throw new NotFoundException({
      code: 'CANDIDATE_NOT_FOUND',
      message: 'Organization candidate was not found',
    });
  }

  private async getResumeFile(
    organizationId: string,
    candidateId: string,
    resumeFileId: string,
  ) {
    const file = await this.resumeFilesRepository.findById({
      organizationId,
      candidateId,
      resumeFileId,
    });

    if (file) {
      return file;
    }

    this.throwResumeFileNotFound();
  }

  private async readUploadedObjectMetadata(file: CandidateResumeFileRecord) {
    try {
      return await this.storageService.getObjectMetadata(file.objectKey);
    } catch {
      return {
        contentType: null,
        contentLength: null,
      };
    }
  }

  private async readUploadedObjectPrefixBytes(file: CandidateResumeFileRecord) {
    try {
      return await this.storageService.getObjectPrefixBytes(file.objectKey, 5);
    } catch {
      return Buffer.alloc(0);
    }
  }

  private getRejectionReason(
    file: CandidateResumeFileRecord,
    metadata: { contentType: string | null; contentLength: number | null },
    prefixBytes: Buffer,
  ) {
    if (metadata.contentType !== CANDIDATE_RESUME_PDF_MIME_TYPE) {
      return 'invalid_content_type';
    }

    if (prefixBytes.toString('ascii') !== '%PDF-') {
      return 'invalid_pdf_signature';
    }

    if (metadata.contentLength === null) {
      return 'missing_content_length';
    }

    if (metadata.contentLength > this.storageService.maxFileSizeBytes) {
      return 'file_too_large';
    }

    if (metadata.contentLength !== file.sizeBytes) {
      return 'file_size_mismatch';
    }

    return null;
  }

  private async rejectUploadedObject(
    session: AuthenticatedSession,
    file: CandidateResumeFileRecord,
    reason: string,
  ) {
    try {
      await this.storageService.deleteObject(file.objectKey);
    } catch {
      this.logger.warn(
        {
          event: 'candidate.resume_file.delete_rejected_failed',
          organizationId: file.organizationId,
          actorUserId: session.user.id,
          candidateId: file.candidateId,
          resumeFileId: file.id,
          reason,
        },
        'CandidateResumeFilesService',
      );
    }

    await this.resumeFilesRepository.markRejected({
      organizationId: file.organizationId,
      candidateId: file.candidateId,
      resumeFileId: file.id,
      actorUserId: session.user.id,
      reason,
    });

    this.logger.warn(
      {
        event: CANDIDATE_RESUME_FILE_EVENT_TYPES.rejected,
        organizationId: file.organizationId,
        actorUserId: session.user.id,
        candidateId: file.candidateId,
        resumeFileId: file.id,
        reason,
      },
      'CandidateResumeFilesService',
    );
  }

  private normalizePdfFileName(value: string) {
    const fileName = this.sanitizeDownloadFileName(value);

    if (!fileName.toLocaleLowerCase().endsWith('.pdf')) {
      throw new BadRequestException({
        code: 'CANDIDATE_RESUME_FILE_EXTENSION_INVALID',
        message: 'Candidate resume file must be a PDF',
      });
    }

    return fileName;
  }

  private sanitizeDownloadFileName(value: string) {
    const sanitized = value
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/[\r\n]/g, '')
      .replace(/\s+/g, ' ');

    if (sanitized.length > 0) {
      return sanitized;
    }

    throw new BadRequestException({
      code: 'CANDIDATE_RESUME_FILE_NAME_EMPTY',
      message: 'Candidate resume file name cannot be blank',
    });
  }

  private assertValidFileSize(sizeBytes: number) {
    if (sizeBytes <= this.storageService.maxFileSizeBytes) {
      return;
    }

    throw new BadRequestException({
      code: 'CANDIDATE_RESUME_FILE_TOO_LARGE',
      maxFileSizeBytes: this.storageService.maxFileSizeBytes,
      message: 'Candidate resume file exceeds maximum allowed size',
    });
  }

  private buildPendingObjectKey(input: {
    organizationId: string;
    candidateId: string;
    resumeFileId: string;
  }) {
    return [
      'pending',
      'organizations',
      input.organizationId,
      'candidates',
      input.candidateId,
      'resumes',
      `${input.resumeFileId}.pdf`,
    ].join('/');
  }

  private buildFinalObjectKey(input: {
    organizationId: string;
    candidateId: string;
    resumeFileId: string;
  }) {
    return [
      'organizations',
      input.organizationId,
      'candidates',
      input.candidateId,
      'resumes',
      `${input.resumeFileId}.pdf`,
    ].join('/');
  }

  private expiresAt(expiresSeconds: number) {
    return new Date(Date.now() + expiresSeconds * 1000);
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

  private throwResumeFileNotFound(): never {
    throw new NotFoundException({
      code: 'CANDIDATE_RESUME_FILE_NOT_FOUND',
      message: 'Candidate resume file was not found',
    });
  }

  private toResponse(
    file: CandidateResumeFileRecord,
  ): CandidateResumeFileResponseDto {
    return {
      id: file.id,
      organizationId: file.organizationId,
      candidateId: file.candidateId,
      storageProvider: file.storageProvider,
      bucket: file.bucket,
      objectKey: file.objectKey,
      originalFileName: file.originalFileName,
      mimeType: CANDIDATE_RESUME_PDF_MIME_TYPE,
      sizeBytes: file.sizeBytes,
      checksumSha256: file.checksumSha256 ?? null,
      status: file.status,
      isCurrent: file.isCurrent,
      uploadedAt: file.uploadedAt?.toISOString() ?? null,
      rejectedAt: file.rejectedAt?.toISOString() ?? null,
      rejectionReason: file.rejectionReason ?? null,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    };
  }
}

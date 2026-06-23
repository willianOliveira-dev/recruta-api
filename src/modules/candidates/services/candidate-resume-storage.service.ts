import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { env } from '../../../config/env.schema';
import { CANDIDATE_RESUME_PDF_MIME_TYPE } from '../dto/candidate-resume-file.dto';

interface ResumeStorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
}

export interface ResumeObjectMetadata {
  contentType: string | null;
  contentLength: number | null;
}

@Injectable()
export class CandidateResumeStorageService {
  private s3Client: S3Client | null = null;

  get bucket() {
    return this.getConfig().bucket;
  }

  get maxFileSizeBytes() {
    return env.CANDIDATE_RESUME_MAX_FILE_SIZE_BYTES;
  }

  get uploadUrlExpiresSeconds() {
    return env.CANDIDATE_RESUME_UPLOAD_URL_EXPIRES_SECONDS;
  }

  get accessUrlExpiresSeconds() {
    return env.CANDIDATE_RESUME_ACCESS_URL_EXPIRES_SECONDS;
  }

  async createUploadUrl(input: { objectKey: string }) {
    return getSignedUrl(
      this.getClient(),
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.objectKey,
        ContentType: CANDIDATE_RESUME_PDF_MIME_TYPE,
      }),
      { expiresIn: this.uploadUrlExpiresSeconds },
    );
  }

  async createAccessUrl(input: {
    objectKey: string;
    originalFileName: string;
    disposition: 'inline' | 'attachment';
  }) {
    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: input.objectKey,
        ResponseContentType: CANDIDATE_RESUME_PDF_MIME_TYPE,
        ResponseContentDisposition: `${input.disposition}; filename="${input.originalFileName}"`,
      }),
      { expiresIn: this.accessUrlExpiresSeconds },
    );
  }

  async getObjectMetadata(objectKey: string): Promise<ResumeObjectMetadata> {
    const response = await this.getClient().send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );

    return {
      contentType: response.ContentType ?? null,
      contentLength: response.ContentLength ?? null,
    };
  }

  async getObjectPrefixBytes(objectKey: string, bytes: number) {
    const response = await this.getClient().send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Range: `bytes=0-${bytes - 1}`,
      }),
    );

    if (!response.Body) {
      return Buffer.alloc(0);
    }

    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  async deleteObject(objectKey: string) {
    await this.getClient().send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );
  }

  async moveObject(input: {
    sourceObjectKey: string;
    targetObjectKey: string;
  }) {
    await this.getClient().send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${input.sourceObjectKey}`,
        Key: input.targetObjectKey,
        ContentType: CANDIDATE_RESUME_PDF_MIME_TYPE,
        MetadataDirective: 'REPLACE',
      }),
    );

    await this.deleteObject(input.sourceObjectKey);
  }

  private getConfig(): ResumeStorageConfig {
    const accountId = this.required('R2_ACCOUNT_ID', env.R2_ACCOUNT_ID);
    const accessKeyId = this.required('R2_ACCESS_KEY_ID', env.R2_ACCESS_KEY_ID);
    const secretAccessKey = this.required(
      'R2_SECRET_ACCESS_KEY',
      env.R2_SECRET_ACCESS_KEY,
    );
    const bucket = this.required('R2_BUCKET', env.R2_BUCKET);

    return {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      region: env.R2_REGION,
    };
  }

  private getClient() {
    if (this.s3Client) {
      return this.s3Client;
    }

    const config = this.getConfig();
    this.s3Client = new S3Client({
      region: config.region,
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    return this.s3Client;
  }

  private required(name: string, value: string | undefined) {
    const normalized = value?.trim();

    if (normalized) {
      return normalized;
    }

    throw new ServiceUnavailableException({
      code: 'RESUME_STORAGE_NOT_CONFIGURED',
      message: `${name} must be configured before signing resume file URLs`,
    });
  }
}

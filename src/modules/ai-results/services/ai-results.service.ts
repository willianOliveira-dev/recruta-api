import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  APP_LOGGER,
  type ApplicationLogger,
} from '../../../common/logger/logger.tokens';
import { EMBEDDING_DIMENSIONS } from '../../../database/drizzle/schema-helpers';
import {
  AI_JOB_TYPE_BY_RESULT_EVENT,
  AI_RESULT_EVENT_TYPES,
} from '../domain/ai-result-events';
import type { AiResultEnvelopeDto } from '../dto/ai-result-envelope.dto';
import { AiResultsRepository } from '../repositories/ai-results.repository';
import type {
  AiUsageInput,
  CompletedEmbeddingInput,
  CompletedMatchInput,
  EmbeddingChunkInput,
  EmbeddingEntityType,
  FailedAiResultInput,
} from '../types/ai-result-processing';

@Injectable()
export class AiResultsService {
  constructor(
    private readonly aiResultsRepository: AiResultsRepository,
    @Inject(APP_LOGGER)
    private readonly logger: ApplicationLogger,
  ) {}

  async processResult(
    dto: AiResultEnvelopeDto,
  ): Promise<{ accepted: true; processed: boolean; duplicate: boolean }> {
    const processedAt = new Date();
    const metadata = dto.metadata ?? {};
    const inbox = await this.aiResultsRepository.createInboxEvent({
      eventId: dto.eventId,
      eventType: dto.eventType,
      organizationId: dto.organizationId,
      correlationId: dto.correlationId ?? null,
      payloadHash: this.hashPayload(dto.payload),
      payload: dto.payload,
      metadata,
    });

    if (!inbox) {
      this.logger.log(
        {
          event: 'ai_result.duplicate_ignored',
          eventId: dto.eventId,
          eventType: dto.eventType,
          organizationId: dto.organizationId,
        },
        'AiResultsService',
      );

      return { accepted: true, processed: false, duplicate: true };
    }

    try {
      await this.applyResult(dto, processedAt);
      await this.aiResultsRepository.markInboxProcessed(inbox.id, processedAt);
      this.logger.log(
        {
          event: 'ai_result.processed',
          eventId: dto.eventId,
          eventType: dto.eventType,
          organizationId: dto.organizationId,
          entityType: dto.entity.type,
          entityId: dto.entity.id,
        },
        'AiResultsService',
      );

      return { accepted: true, processed: true, duplicate: false };
    } catch (error) {
      await this.aiResultsRepository.markInboxFailed({
        inboxId: inbox.id,
        errorMessage: this.safeErrorMessage(error),
        failedAt: new Date(),
      });
      this.logger.error(
        {
          event: 'ai_result.processing_failed',
          eventId: dto.eventId,
          eventType: dto.eventType,
          organizationId: dto.organizationId,
          entityType: dto.entity.type,
          entityId: dto.entity.id,
        },
        error instanceof Error ? error.stack : undefined,
        'AiResultsService',
      );
      throw error;
    }
  }

  private async applyResult(
    dto: AiResultEnvelopeDto,
    processedAt: Date,
  ): Promise<void> {
    if (dto.eventType === AI_RESULT_EVENT_TYPES.embeddingCompleted) {
      await this.aiResultsRepository.applyCompletedEmbedding(
        this.parseCompletedEmbedding(dto, processedAt),
      );
      return;
    }

    if (dto.eventType === AI_RESULT_EVENT_TYPES.matchCompleted) {
      const updated = await this.aiResultsRepository.applyCompletedMatch(
        this.parseCompletedMatch(dto, processedAt),
      );

      if (!updated) {
        throw new NotFoundException({
          code: 'APPLICATION_NOT_FOUND',
          message: 'Organization application was not found for AI match result',
        });
      }

      return;
    }

    await this.aiResultsRepository.applyFailedResult(
      this.parseFailedResult(dto, processedAt),
    );
  }

  private parseCompletedEmbedding(
    dto: AiResultEnvelopeDto,
    processedAt: Date,
  ): CompletedEmbeddingInput {
    const document = this.readRecord(dto.payload.document) ?? dto.payload;
    const entityType = this.readEmbeddingEntityType(
      document.entityType ?? dto.entity.type,
    );
    const entityId = this.readString(document.entityId ?? dto.entity.id, 'entityId');
    const chunks = this.readArray(document.chunks ?? dto.payload.chunks, 'chunks');

    return {
      organizationId: dto.organizationId,
      entityType,
      entityId,
      source: this.readString(document.source, 'source'),
      sourceHash: this.readString(document.sourceHash, 'sourceHash'),
      embeddingModel: this.readString(document.embeddingModel, 'embeddingModel'),
      embeddingDimensions: this.readOptionalNumber(
        document.embeddingDimensions,
      ) ?? EMBEDDING_DIMENSIONS,
      metadata: this.readRecord(document.metadata) ?? {},
      chunks: chunks.map((chunk, index) => this.parseChunk(chunk, index)),
      usage: this.parseUsage(dto.payload.usage),
      processedAt,
    };
  }

  private parseCompletedMatch(
    dto: AiResultEnvelopeDto,
    processedAt: Date,
  ): CompletedMatchInput {
    const applicationId = this.readString(
      dto.payload.applicationId ?? dto.entity.id,
      'applicationId',
    );
    const aiScore = this.readNumber(dto.payload.aiScore, 'aiScore');

    if (aiScore < 0 || aiScore > 100) {
      throw new BadRequestException({
        code: 'AI_RESULT_SCORE_INVALID',
        message: 'AI match score must be between 0 and 100',
      });
    }

    return {
      organizationId: dto.organizationId,
      applicationId,
      aiScore,
      aiSummary: this.readOptionalString(dto.payload.aiSummary),
      usage: this.parseUsage(dto.payload.usage),
      processedAt,
    };
  }

  private parseFailedResult(
    dto: AiResultEnvelopeDto,
    processedAt: Date,
  ): FailedAiResultInput {
    return {
      organizationId: dto.organizationId,
      entityType: dto.entity.type,
      entityId: dto.entity.id,
      jobType: AI_JOB_TYPE_BY_RESULT_EVENT[dto.eventType],
      errorMessage:
        this.readOptionalString(dto.payload.errorMessage) ??
        this.readOptionalString(dto.payload.error) ??
        'AI worker reported a processing failure',
      usage: this.parseUsage(dto.payload.usage),
      processedAt,
    };
  }

  private parseChunk(value: unknown, fallbackIndex: number): EmbeddingChunkInput {
    const chunk = this.requireRecord(value, 'chunk');
    const embedding = this.readNumberArray(chunk.embedding, 'embedding');

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new BadRequestException({
        code: 'AI_RESULT_EMBEDDING_DIMENSIONS_INVALID',
        message: `Embedding chunks must have ${EMBEDDING_DIMENSIONS} dimensions`,
      });
    }

    return {
      chunkIndex: this.readOptionalNumber(chunk.chunkIndex) ?? fallbackIndex,
      content: this.readString(chunk.content, 'content'),
      contentHash: this.readString(chunk.contentHash, 'contentHash'),
      tokenCount: this.readOptionalNumber(chunk.tokenCount),
      embedding,
      metadata: this.readRecord(chunk.metadata) ?? {},
    };
  }

  private parseUsage(value: unknown): AiUsageInput {
    const usage = this.readRecord(value) ?? {};

    return {
      promptTokens: this.readOptionalNumber(usage.promptTokens) ?? 0,
      completionTokens: this.readOptionalNumber(usage.completionTokens) ?? 0,
      embeddingTokens: this.readOptionalNumber(usage.embeddingTokens) ?? 0,
      cachedTokens: this.readOptionalNumber(usage.cachedTokens) ?? 0,
      requestsCount: this.readOptionalNumber(usage.requestsCount) ?? 1,
    };
  }

  private readEmbeddingEntityType(value: unknown): EmbeddingEntityType {
    const entityType = this.readString(value, 'entityType');
    const allowedTypes = [
      'organization',
      'organization_profile',
      'job',
      'job_skill',
      'candidate',
      'candidate_skill',
      'candidate_experience',
      'application',
      'application_stage_history',
      'interview_note',
      'subscription_plan',
      'organization_subscription',
      'organization_ai_usage',
      'member',
      'invitation',
      'payment',
      'audit_log',
    ];

    if (!allowedTypes.includes(entityType)) {
      throw new BadRequestException({
        code: 'AI_RESULT_ENTITY_TYPE_INVALID',
        message: 'AI embedding result entity type is not supported',
      });
    }

    return entityType as EmbeddingEntityType;
  }

  private requireRecord(value: unknown, fieldName: string): Record<string, unknown> {
    const record = this.readRecord(value);

    if (record) {
      return record;
    }

    throw new BadRequestException({
      code: 'AI_RESULT_PAYLOAD_INVALID',
      message: `AI result payload field ${fieldName} must be an object`,
    });
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private readArray(value: unknown, fieldName: string): unknown[] {
    if (Array.isArray(value)) {
      return value;
    }

    throw new BadRequestException({
      code: 'AI_RESULT_PAYLOAD_INVALID',
      message: `AI result payload field ${fieldName} must be an array`,
    });
  }

  private readString(value: unknown, fieldName: string): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    throw new BadRequestException({
      code: 'AI_RESULT_PAYLOAD_INVALID',
      message: `AI result payload field ${fieldName} must be a non-empty string`,
    });
  }

  private readOptionalString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    throw new BadRequestException({
      code: 'AI_RESULT_PAYLOAD_INVALID',
      message: 'AI result optional text field must be a string',
    });
  }

  private readNumber(value: unknown, fieldName: string): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    throw new BadRequestException({
      code: 'AI_RESULT_PAYLOAD_INVALID',
      message: `AI result payload field ${fieldName} must be a number`,
    });
  }

  private readOptionalNumber(value: unknown): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    throw new BadRequestException({
      code: 'AI_RESULT_PAYLOAD_INVALID',
      message: 'AI result optional numeric field must be a number',
    });
  }

  private readNumberArray(value: unknown, fieldName: string): number[] {
    if (
      Array.isArray(value) &&
      value.every((item) => typeof item === 'number' && Number.isFinite(item))
    ) {
      return value;
    }

    throw new BadRequestException({
      code: 'AI_RESULT_PAYLOAD_INVALID',
      message: `AI result payload field ${fieldName} must be a number array`,
    });
  }

  private hashPayload(payload: Record<string, unknown>): string {
    return createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown AI result processing failure';
  }
}

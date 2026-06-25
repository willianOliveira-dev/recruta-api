import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { database } from '../../../config/database.config';
import { DRIZZLE } from '../../../database/drizzle/drizzle.module';
import {
  aiProcessingJob,
  application,
  embeddingChunk,
  embeddingDocument,
  inboxEvent,
  organizationAiUsage,
} from '../../../database/drizzle/schema';
import {
  AI_RESULT_SOURCE,
  type AiResultEventType,
} from '../domain/ai-result-events';
import {
  type CompletedEmbeddingInput,
  type CompletedMatchInput,
  type FailedAiResultInput,
  type AiUsageInput,
} from '../types/ai-result-processing';

type Database = typeof database;
type InboxEventRecord = typeof inboxEvent.$inferSelect;

@Injectable()
export class AiResultsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async createInboxEvent(input: {
    eventId: string;
    eventType: AiResultEventType;
    organizationId: string;
    correlationId: string | null;
    payloadHash: string;
    payload: Record<string, unknown>;
    metadata: Record<string, unknown>;
  }): Promise<InboxEventRecord | null> {
    const [created] = await this.db
      .insert(inboxEvent)
      .values({
        eventId: input.eventId,
        eventType: input.eventType,
        source: AI_RESULT_SOURCE,
        organizationId: input.organizationId,
        correlationId: input.correlationId,
        payloadHash: input.payloadHash,
        payload: input.payload,
        metadata: input.metadata,
        status: 'processing',
        attempts: 1,
      })
      .onConflictDoNothing({
        target: [inboxEvent.source, inboxEvent.eventId],
      })
      .returning();

    return created ?? null;
  }

  async markInboxProcessed(inboxId: string, processedAt: Date): Promise<void> {
    await this.db
      .update(inboxEvent)
      .set({
        status: 'processed',
        processedAt,
        lastError: null,
        updatedAt: processedAt,
      })
      .where(eq(inboxEvent.id, inboxId));
  }

  async markInboxFailed(input: {
    inboxId: string;
    errorMessage: string;
    failedAt: Date;
  }): Promise<void> {
    await this.db
      .update(inboxEvent)
      .set({
        status: 'failed',
        lastError: input.errorMessage,
        updatedAt: input.failedAt,
      })
      .where(eq(inboxEvent.id, input.inboxId));
  }

  async applyCompletedEmbedding(input: CompletedEmbeddingInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [document] = await tx
        .insert(embeddingDocument)
        .values({
          organizationId: input.organizationId,
          entityType: input.entityType,
          entityId: input.entityId,
          source: input.source,
          sourceHash: input.sourceHash,
          embeddingModel: input.embeddingModel,
          embeddingDimensions: input.embeddingDimensions,
          status: 'embedded',
          metadata: input.metadata,
          lastEmbeddedAt: input.processedAt,
          errorMessage: null,
        })
        .onConflictDoUpdate({
          target: [
            embeddingDocument.entityType,
            embeddingDocument.entityId,
            embeddingDocument.source,
            embeddingDocument.embeddingModel,
            embeddingDocument.sourceHash,
          ],
          set: {
            organizationId: input.organizationId,
            embeddingDimensions: input.embeddingDimensions,
            status: 'embedded',
            metadata: input.metadata,
            lastEmbeddedAt: input.processedAt,
            errorMessage: null,
            updatedAt: input.processedAt,
          },
        })
        .returning();

      await tx
        .delete(embeddingChunk)
        .where(eq(embeddingChunk.documentId, document.id));

      if (input.chunks.length > 0) {
        await tx.insert(embeddingChunk).values(
          input.chunks.map((chunk) => ({
            documentId: document.id,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            contentHash: chunk.contentHash,
            tokenCount: chunk.tokenCount,
            embedding: chunk.embedding,
            metadata: chunk.metadata,
          })),
        );
      }

      await this.incrementUsage(tx, input.organizationId, input.usage, input.processedAt);
      await this.markJobCompleted(tx, {
        organizationId: input.organizationId,
        jobType: 'embedding',
        entityType: input.entityType,
        entityId: input.entityId,
        resultPayload: {
          documentId: document.id,
          chunksCount: input.chunks.length,
          sourceHash: input.sourceHash,
        },
        finishedAt: input.processedAt,
      });
    });
  }

  async applyCompletedMatch(input: CompletedMatchInput): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(application)
        .set({
          aiScore: String(input.aiScore),
          aiSummary: input.aiSummary,
          updatedAt: input.processedAt,
        })
        .where(
          and(
            eq(application.organizationId, input.organizationId),
            eq(application.id, input.applicationId),
          ),
        )
        .returning();

      if (!updated) {
        return false;
      }

      await this.incrementUsage(tx, input.organizationId, input.usage, input.processedAt);
      await this.markJobCompleted(tx, {
        organizationId: input.organizationId,
        jobType: 'match',
        entityType: 'application',
        entityId: input.applicationId,
        resultPayload: {
          aiScore: input.aiScore,
          hasSummary: Boolean(input.aiSummary),
        },
        finishedAt: input.processedAt,
      });

      return true;
    });
  }

  async applyFailedResult(input: FailedAiResultInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      if (
        input.jobType === 'embedding' &&
        this.isEmbeddingEntityType(input.entityType)
      ) {
        await tx
          .update(embeddingDocument)
          .set({
            status: 'failed',
            errorMessage: input.errorMessage,
            updatedAt: input.processedAt,
          })
          .where(
            and(
              eq(embeddingDocument.organizationId, input.organizationId),
              eq(embeddingDocument.entityType, input.entityType),
              eq(embeddingDocument.entityId, input.entityId),
            ),
          );
      }

      await this.incrementUsage(tx, input.organizationId, input.usage, input.processedAt);
      await tx
        .update(aiProcessingJob)
        .set({
          status: 'failed',
          lastError: input.errorMessage,
          finishedAt: input.processedAt,
          updatedAt: input.processedAt,
        })
        .where(
          and(
            eq(aiProcessingJob.organizationId, input.organizationId),
            eq(aiProcessingJob.jobType, input.jobType),
            eq(aiProcessingJob.entityType, input.entityType),
            eq(aiProcessingJob.entityId, input.entityId),
            inArray(aiProcessingJob.status, [
              'pending',
              'queued',
              'processing',
              'failed',
            ]),
          ),
        );
    });
  }

  private async incrementUsage(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    organizationId: string,
    usage: AiUsageInput,
    occurredAt: Date,
  ) {
    const year = occurredAt.getUTCFullYear();
    const month = occurredAt.getUTCMonth() + 1;

    await tx
      .insert(organizationAiUsage)
      .values({
        organizationId,
        year,
        month,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        embeddingTokens: usage.embeddingTokens,
        cachedTokens: usage.cachedTokens,
        requestsCount: usage.requestsCount,
      })
      .onConflictDoUpdate({
        target: [
          organizationAiUsage.organizationId,
          organizationAiUsage.year,
          organizationAiUsage.month,
        ],
        set: {
          promptTokens: sql`${organizationAiUsage.promptTokens} + ${usage.promptTokens}`,
          completionTokens: sql`${organizationAiUsage.completionTokens} + ${usage.completionTokens}`,
          embeddingTokens: sql`${organizationAiUsage.embeddingTokens} + ${usage.embeddingTokens}`,
          cachedTokens: sql`${organizationAiUsage.cachedTokens} + ${usage.cachedTokens}`,
          requestsCount: sql`${organizationAiUsage.requestsCount} + ${usage.requestsCount}`,
          updatedAt: occurredAt,
        },
      });
  }

  private async markJobCompleted(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    input: {
      organizationId: string;
      jobType: string;
      entityType: string;
      entityId: string;
      resultPayload: Record<string, unknown>;
      finishedAt: Date;
    },
  ) {
    await tx
      .update(aiProcessingJob)
      .set({
        status: 'completed',
        resultPayload: input.resultPayload,
        finishedAt: input.finishedAt,
        lastError: null,
        updatedAt: input.finishedAt,
      })
      .where(
        and(
          eq(aiProcessingJob.organizationId, input.organizationId),
          eq(aiProcessingJob.jobType, input.jobType),
          eq(aiProcessingJob.entityType, input.entityType),
          eq(aiProcessingJob.entityId, input.entityId),
          inArray(aiProcessingJob.status, [
            'pending',
            'queued',
            'processing',
            'failed',
          ]),
        ),
      );
  }

  private isEmbeddingEntityType(value: string): value is CompletedEmbeddingInput['entityType'] {
    return [
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
    ].includes(value);
  }
}

import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ApplicationLogger } from '../../../common/logger/logger.tokens';
import { AI_RESULT_EVENT_TYPES } from '../domain/ai-result-events';
import type { AiResultEnvelopeDto } from '../dto/ai-result-envelope.dto';
import type { AiResultsRepository } from '../repositories/ai-results.repository';

jest.mock('../repositories/ai-results.repository', () => ({
  AiResultsRepository: class AiResultsRepository {},
}));

jest.mock('../../../database/drizzle/schema-helpers', () => ({
  EMBEDDING_DIMENSIONS: 1536,
}));

import { AiResultsService } from '../services/ai-results.service';

interface AiResultsRepositoryMock {
  createInboxEvent: jest.Mock;
  markInboxProcessed: jest.Mock;
  markInboxFailed: jest.Mock;
  applyCompletedEmbedding: jest.Mock;
  applyCompletedMatch: jest.Mock;
  applyFailedResult: jest.Mock;
}

interface LoggerMock {
  log: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

const organizationId = '01972194-7d9f-7000-9c9e-b2abdc1d88e0';
const applicationId = '01972194-7d9f-7000-9c9e-b2abdc1d9002';
const eventId = '01972194-7d9f-7000-9c9e-b2abdc1d9003';
const nowIso = '2026-06-24T12:00:00.000Z';
const EMBEDDING_DIMENSIONS = 1536;

const makeEnvelope = (
  overrides: Partial<AiResultEnvelopeDto> = {},
): AiResultEnvelopeDto => ({
  eventId,
  eventType: AI_RESULT_EVENT_TYPES.matchCompleted,
  version: 1,
  occurredAt: nowIso,
  organizationId,
  correlationId: null,
  entity: {
    type: 'application',
    id: applicationId,
  },
  payload: {
    applicationId,
    aiScore: 87.5,
    aiSummary: 'Strong evidence of backend fit.',
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      embeddingTokens: 0,
      cachedTokens: 10,
      requestsCount: 1,
    },
  },
  metadata: {},
  ...overrides,
});

describe('AiResultsService', () => {
  let repository: AiResultsRepositoryMock;
  let logger: LoggerMock;
  let service: AiResultsService;

  beforeEach(() => {
    repository = {
      createInboxEvent: jest.fn(),
      markInboxProcessed: jest.fn(),
      markInboxFailed: jest.fn(),
      applyCompletedEmbedding: jest.fn(),
      applyCompletedMatch: jest.fn(),
      applyFailedResult: jest.fn(),
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    repository.createInboxEvent.mockResolvedValue({
      id: '01972194-7d9f-7000-9c9e-b2abdc1d9004',
    });
    repository.applyCompletedMatch.mockResolvedValue(true);
    service = new AiResultsService(
      repository as unknown as AiResultsRepository,
      logger as unknown as ApplicationLogger,
    );
  });

  it('processes match results once and marks the inbox event as processed', async () => {
    const result = await service.processResult(makeEnvelope());

    expect(result).toEqual({
      accepted: true,
      processed: true,
      duplicate: false,
    });
    expect(repository.createInboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId,
        eventType: 'ai.match.completed',
        organizationId,
      }),
    );
    expect(repository.applyCompletedMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        applicationId,
        aiScore: 87.5,
        aiSummary: 'Strong evidence of backend fit.',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          embeddingTokens: 0,
          cachedTokens: 10,
          requestsCount: 1,
        },
      }),
    );
    expect(repository.markInboxProcessed).toHaveBeenCalledWith(
      '01972194-7d9f-7000-9c9e-b2abdc1d9004',
      expect.any(Date),
    );
  });

  it('ignores duplicate worker events before applying side effects', async () => {
    repository.createInboxEvent.mockResolvedValue(null);

    const result = await service.processResult(makeEnvelope());

    expect(result).toEqual({
      accepted: true,
      processed: false,
      duplicate: true,
    });
    expect(repository.applyCompletedMatch).not.toHaveBeenCalled();
    expect(repository.markInboxProcessed).not.toHaveBeenCalled();
  });

  it('rejects match scores outside the supported range and records inbox failure', async () => {
    await expect(
      service.processResult(
        makeEnvelope({
          payload: {
            applicationId,
            aiScore: 150,
          },
        }),
      ),
    ).rejects.toThrow(BadRequestException);

    expect(repository.markInboxFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        inboxId: '01972194-7d9f-7000-9c9e-b2abdc1d9004',
      }),
    );
  });

  it('throws a stable not found error when match result references a missing application', async () => {
    repository.applyCompletedMatch.mockResolvedValue(false);

    await expect(service.processResult(makeEnvelope())).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.markInboxFailed).toHaveBeenCalled();
  });

  it('maps embedding results into document and chunk persistence input', async () => {
    const embedding = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1);

    await service.processResult(
      makeEnvelope({
        eventType: AI_RESULT_EVENT_TYPES.embeddingCompleted,
        entity: {
          type: 'candidate',
          id: '01972194-7d9f-7000-9c9e-b2abdc1d9001',
        },
        payload: {
          document: {
            entityType: 'candidate',
            entityId: '01972194-7d9f-7000-9c9e-b2abdc1d9001',
            source: 'resume_text',
            sourceHash: 'sha256:resume',
            embeddingModel: 'text-embedding-3-small',
            embeddingDimensions: EMBEDDING_DIMENSIONS,
            chunks: [
              {
                chunkIndex: 0,
                content: 'Backend engineer with NestJS experience.',
                contentHash: 'sha256:chunk',
                tokenCount: 8,
                embedding,
              },
            ],
          },
          usage: {
            embeddingTokens: 8,
          },
        },
      }),
    );

    expect(repository.applyCompletedEmbedding).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        entityType: 'candidate',
        source: 'resume_text',
        sourceHash: 'sha256:resume',
        chunks: [
          expect.objectContaining({
            chunkIndex: 0,
            contentHash: 'sha256:chunk',
            embedding,
          }),
        ],
        usage: expect.objectContaining({
          embeddingTokens: 8,
          requestsCount: 1,
        }),
      }),
    );
  });
});

import type { ApplicationLogger } from '../../../common/logger/logger.tokens';
import type { OutboxEventPublisher } from '../integrations/outbox-publisher.port';
import type { OutboxRepository } from '../repositories/outbox.repository';

jest.mock('../repositories/outbox.repository', () => ({
  OutboxRepository: class OutboxRepository {},
}));

jest.mock('../../../config/env.schema', () => ({
  env: {
    RABBITMQ_AI_EXCHANGE: 'recruta.ai',
    RABBITMQ_DOMAIN_EXCHANGE: 'recruta.domain',
  },
}));

import { OutboxService } from '../services/outbox.service';

interface OutboxRepositoryMock {
  claimPending: jest.Mock;
  markPublished: jest.Mock;
  markFailed: jest.Mock;
}

interface OutboxEventPublisherMock {
  publish: jest.Mock;
}

interface LoggerMock {
  log: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

const now = new Date('2026-06-24T12:00:00.000Z');

const makeEvent = (overrides: Record<string, unknown> = {}) => ({
  id: '01972194-7d9f-7000-9c9e-b2abdc1d9003',
  eventType: 'application.created',
  version: 1,
  occurredAt: now,
  organizationId: '01972194-7d9f-7000-9c9e-b2abdc1d88e0',
  actorUserId: '01972194-7d9f-7000-9c9e-b2abdc1d88de',
  correlationId: null,
  entityType: 'application',
  entityId: '01972194-7d9f-7000-9c9e-b2abdc1d9002',
  payload: { jobId: '01972194-7d9f-7000-9c9e-b2abdc1d9000' },
  metadata: {},
  status: 'pending',
  attempts: 0,
  nextAttemptAt: null,
  lockedAt: null,
  lockedBy: null,
  publishedAt: null,
  lastError: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe('OutboxService', () => {
  let repository: OutboxRepositoryMock;
  let publisher: OutboxEventPublisherMock;
  let logger: LoggerMock;
  let service: OutboxService;

  beforeEach(() => {
    repository = {
      claimPending: jest.fn(),
      markPublished: jest.fn(),
      markFailed: jest.fn(),
    };
    publisher = {
      publish: jest.fn(),
    };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    service = new OutboxService(
      repository as unknown as OutboxRepository,
      publisher as unknown as OutboxEventPublisher,
      logger as unknown as ApplicationLogger,
    );
  });

  it('publishes claimed events using the AI exchange for AI-routed domain events', async () => {
    const event = makeEvent();
    repository.claimPending.mockResolvedValue([event]);
    publisher.publish.mockResolvedValue(undefined);

    const result = await service.publishPending(10);

    expect(result).toEqual({ attempted: 1, published: 1, failed: 0 });
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: event.id,
        eventType: 'application.created',
        entity: {
          type: 'application',
          id: event.entityId,
        },
      }),
      expect.objectContaining({
        exchange: 'recruta.ai',
        routingKey: 'application.created',
      }),
    );
    expect(repository.markPublished).toHaveBeenCalledWith(
      event.id,
      expect.any(Date),
    );
  });

  it('marks failed events with incremented attempts and a retry date', async () => {
    const event = makeEvent({ attempts: 2 });
    repository.claimPending.mockResolvedValue([event]);
    publisher.publish.mockRejectedValue(new Error('RabbitMQ unavailable'));

    const result = await service.publishPending();

    expect(result).toEqual({ attempted: 1, published: 0, failed: 1 });
    expect(repository.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: event.id,
        attempts: 3,
        error: 'RabbitMQ unavailable',
        nextAttemptAt: expect.any(Date),
      }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'outbox.publish_failed',
        outboxEventId: event.id,
        attempts: 3,
      }),
      'OutboxService',
    );
  });
});

import { Inject, Injectable } from '@nestjs/common';
import {
  APP_LOGGER,
  type ApplicationLogger,
} from '../../../common/logger/logger.tokens';
import { env } from '../../../config/env.schema';
import {
  OUTBOX_AI_ROUTED_EVENT_TYPES,
  type OutboxEventEnvelope,
  type OutboxPublishRoute,
} from '../domain/outbox-event';
import {
  OUTBOX_EVENT_PUBLISHER,
  type OutboxEventPublisher,
} from '../integrations/outbox-publisher.port';
import {
  type OutboxEventRecord,
  OutboxRepository,
} from '../repositories/outbox.repository';

@Injectable()
export class OutboxService {
  constructor(
    private readonly outboxRepository: OutboxRepository,
    @Inject(OUTBOX_EVENT_PUBLISHER)
    private readonly publisher: OutboxEventPublisher,
    @Inject(APP_LOGGER)
    private readonly logger: ApplicationLogger,
  ) {}

  async publishPending(
    limit = 50,
  ): Promise<{ attempted: number; published: number; failed: number }> {
    const now = new Date();
    const events = await this.outboxRepository.claimPending({
      limit,
      lockedBy: `nestjs:${process.pid}`,
      now,
    });

    let published = 0;
    let failed = 0;

    for (const event of events) {
      try {
        await this.publisher.publish(
          this.toEnvelope(event),
          this.resolveRoute(event),
        );
        await this.outboxRepository.markPublished(event.id, new Date());
        published++;
      } catch (error) {
        failed++;
        const attempts = event.attempts + 1;
        const nextAttemptAt = this.nextAttemptAt(attempts);
        await this.outboxRepository.markFailed({
          eventId: event.id,
          attempts,
          error: this.safeErrorMessage(error),
          nextAttemptAt,
          failedAt: new Date(),
        });
        this.logger.warn(
          {
            event: 'outbox.publish_failed',
            outboxEventId: event.id,
            eventType: event.eventType,
            attempts,
            nextAttemptAt: nextAttemptAt.toISOString(),
          },
          'OutboxService',
        );
      }
    }

    return {
      attempted: events.length,
      published,
      failed,
    };
  }

  private toEnvelope(event: OutboxEventRecord): OutboxEventEnvelope {
    return {
      eventId: event.id,
      eventType: event.eventType,
      version: event.version,
      occurredAt: event.occurredAt.toISOString(),
      organizationId: event.organizationId,
      actorUserId: event.actorUserId,
      correlationId: event.correlationId,
      entity: {
        type: event.entityType,
        id: event.entityId,
      },
      payload: event.payload,
      metadata: event.metadata,
    };
  }

  private resolveRoute(event: OutboxEventRecord): OutboxPublishRoute {
    return {
      exchange: OUTBOX_AI_ROUTED_EVENT_TYPES.has(event.eventType)
        ? env.RABBITMQ_AI_EXCHANGE
        : env.RABBITMQ_DOMAIN_EXCHANGE,
      routingKey: event.eventType,
    };
  }

  private nextAttemptAt(attempts: number): Date {
    const backoffSeconds = Math.min(300, 2 ** Math.min(attempts, 8));
    return new Date(Date.now() + backoffSeconds * 1000);
  }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown outbox publisher failure';
  }
}

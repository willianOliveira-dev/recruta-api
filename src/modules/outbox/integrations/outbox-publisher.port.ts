import type {
  OutboxEventEnvelope,
  OutboxPublishRoute,
} from '../domain/outbox-event';

export const OUTBOX_EVENT_PUBLISHER = Symbol('OUTBOX_EVENT_PUBLISHER');

export interface OutboxEventPublisher {
  publish(
    envelope: OutboxEventEnvelope,
    route: OutboxPublishRoute,
  ): Promise<void>;
}

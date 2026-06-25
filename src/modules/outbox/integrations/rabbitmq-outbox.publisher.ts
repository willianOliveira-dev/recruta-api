import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { connect, type ChannelModel, type ConfirmChannel } from 'amqplib';
import { env } from '../../../config/env.schema';
import type {
  OutboxEventEnvelope,
  OutboxPublishRoute,
} from '../domain/outbox-event';
import { RabbitMqPublisherNotConfiguredError } from '../domain/outbox-errors';
import type { OutboxEventPublisher } from './outbox-publisher.port';

@Injectable()
export class RabbitMqOutboxPublisher
  implements OutboxEventPublisher, OnApplicationShutdown
{
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;

  async publish(
    envelope: OutboxEventEnvelope,
    route: OutboxPublishRoute,
  ): Promise<void> {
    if (!env.RABBITMQ_URL) {
      throw new RabbitMqPublisherNotConfiguredError();
    }

    const channel = await this.getChannel();
    await channel.assertExchange(route.exchange, 'topic', { durable: true });

    channel.publish(
      route.exchange,
      route.routingKey,
      Buffer.from(JSON.stringify(envelope)),
      {
        contentType: 'application/json',
        deliveryMode: 2,
        messageId: envelope.eventId,
        timestamp: Math.floor(Date.now() / 1000),
        headers: {
          eventType: envelope.eventType,
          version: envelope.version,
          organizationId: envelope.organizationId,
          correlationId: envelope.correlationId,
          entityType: envelope.entity.type,
          entityId: envelope.entity.id,
        },
      },
    );
    await channel.waitForConfirms();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
    this.channel = null;
    this.connection = null;
  }

  private async getChannel(): Promise<ConfirmChannel> {
    if (this.channel) {
      return this.channel;
    }

    if (!env.RABBITMQ_URL) {
      throw new RabbitMqPublisherNotConfiguredError();
    }

    this.connection = await connect(env.RABBITMQ_URL);
    this.channel = await this.connection.createConfirmChannel();

    return this.channel;
  }
}

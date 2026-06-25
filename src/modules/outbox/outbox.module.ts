import { Module } from '@nestjs/common';
import { OutboxController } from './controllers/outbox.controller';
import { OUTBOX_EVENT_PUBLISHER } from './integrations/outbox-publisher.port';
import { RabbitMqOutboxPublisher } from './integrations/rabbitmq-outbox.publisher';
import { OutboxRepository } from './repositories/outbox.repository';
import { OutboxService } from './services/outbox.service';

@Module({
  controllers: [OutboxController],
  providers: [
    OutboxRepository,
    OutboxService,
    RabbitMqOutboxPublisher,
    {
      provide: OUTBOX_EVENT_PUBLISHER,
      useExisting: RabbitMqOutboxPublisher,
    },
  ],
  exports: [OutboxService],
})
export class OutboxModule {}

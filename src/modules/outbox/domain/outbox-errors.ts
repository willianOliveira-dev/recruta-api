export class RabbitMqPublisherNotConfiguredError extends Error {
  constructor() {
    super('RabbitMQ publisher is not configured');
    this.name = 'RabbitMqPublisherNotConfiguredError';
  }
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger/app.logger';
import { configureAppRoutes } from './config/app-routes.config';
import { env } from './config/env.schema';

async function bootstrap() {
  const logger = new AppLogger();

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
    logger,
  });

  configureAppRoutes(app, logger);

  await app.listen(env.PORT);
}

bootstrap();

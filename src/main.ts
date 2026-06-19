import { NestFactory } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { auth } from './config/auth.config';
import { env } from './config/env.schema';
import { setupSwagger } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const authHandler = toNodeHandler(auth);
  const httpAdapter = app.getHttpAdapter().getInstance();

  httpAdapter.all('/api/auth', authHandler);
  httpAdapter.all('/api/auth/*splat', authHandler);

  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.setGlobalPrefix('api', {
    exclude: ['docs', 'openapi.json', 'openapi.yaml'],
  });

  app.enableCors({
    origin: env.ALLOWED_TRUSTED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  setupSwagger(app);

  await app.listen(env.PORT);
}

bootstrap();

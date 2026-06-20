import { VersioningType, type INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import { json, urlencoded } from 'express';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { rootPresentation } from '../common/http/presentation/root.presentation';
import { HttpResponseInterceptor } from '../common/interceptors/http-response.interceptor';
import type { AppLogger } from '../common/logger/app.logger';
import { httpLoggerMiddleware } from '../common/middlewares/http-logger.middleware';
import { createHttpValidationPipe } from '../common/pipes/http-validation.pipe';
import { auth } from './auth.config';
import {
  API_PREFIX,
  API_VERSION,
  AUTH_BASE_PATH,
  DOCS_PATH,
  OPENAPI_JSON_PATH,
  OPENAPI_YAML_PATH,
} from './api-routes.config';
import { env } from './env.schema';
import { setupSwagger } from './swagger.config';

export const configureAppRoutes = (
  app: INestApplication,
  logger: AppLogger,
) => {
  const authHandler = toNodeHandler(auth);
  const httpAdapter = app.getHttpAdapter().getInstance();

  app.useLogger(logger);
  app.use(httpLoggerMiddleware(logger));
  app.useGlobalFilters(
    new GlobalExceptionFilter(app.get(HttpAdapterHost), logger),
  );
  app.useGlobalPipes(createHttpValidationPipe());
  app.useGlobalInterceptors(new HttpResponseInterceptor());

  httpAdapter.get('/', rootPresentation);
  httpAdapter.all(AUTH_BASE_PATH, authHandler);
  httpAdapter.all(`${AUTH_BASE_PATH}/*splat`, authHandler);

  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.setGlobalPrefix(API_PREFIX, {
    exclude: [DOCS_PATH, OPENAPI_JSON_PATH, OPENAPI_YAML_PATH],
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_VERSION,
  });

  app.enableCors({
    origin: env.ALLOWED_TRUSTED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  setupSwagger(app);
};

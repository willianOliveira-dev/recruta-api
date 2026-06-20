import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import {
  AUTH_OPENAPI_SCHEMA_PATH,
  DOCS_URL,
  OPENAPI_JSON_URL,
  OPENAPI_YAML_URL,
} from './api-routes.config';

export const setupSwagger = (app: INestApplication) => {
  const config = new DocumentBuilder()
    .setTitle('Recruta API')
    .setDescription('Documentacao OpenAPI da API principal do Recruta.')
    .setVersion('1.0.0')
    .addServer('/', 'Current host')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'bearer',
    )
    .addCookieAuth('better-auth.session_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'better-auth.session_token',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });

  SwaggerModule.setup('openapi', app, document, {
    ui: false,
    raw: ['json', 'yaml'],
    jsonDocumentUrl: OPENAPI_JSON_URL,
    yamlDocumentUrl: OPENAPI_YAML_URL,
  });

  app.use(
    DOCS_URL,
    apiReference({
      sources: [
        {
          title: 'Recruta API',
          url: OPENAPI_JSON_URL,
        },
        {
          title: 'Auth',
          url: AUTH_OPENAPI_SCHEMA_PATH,
        },
      ],
      theme: 'default',
      layout: 'modern',
      darkMode: false,
      metaData: {
        title: 'Recruta API Docs',
      },
    }),
  );
};

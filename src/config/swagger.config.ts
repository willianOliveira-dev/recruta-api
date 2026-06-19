import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

export const setupSwagger = (app: INestApplication) => {
  const config = new DocumentBuilder()
    .setTitle('Recruta API')
    .setDescription('Documentacao OpenAPI da API principal do Recruta.')
    .setVersion('1.0.0')
    .addServer('/api', 'API')
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
    jsonDocumentUrl: '/openapi.json',
    yamlDocumentUrl: '/openapi.yaml',
  });

  app.use(
    '/docs',
    apiReference({
      sources: [
        {
          title: 'Recruta API',
          url: '/openapi.json',
        },
        {
          title: 'Better Auth',
          url: '/api/auth/open-api/generate-schema',
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

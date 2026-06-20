import type { Request, Response } from 'express';
import {
  API_BASE_PATH,
  AUTH_BASE_PATH,
  DOCS_URL,
  HEALTH_BASE_PATH,
  OPENAPI_JSON_URL,
} from '../../../config/api-routes.config';

export const rootPresentation = (_request: Request, response: Response) => {
  response.status(200).json({
    name: 'Recruta API',
    status: 'ok',
    api: {
      baseUrl: API_BASE_PATH,
      version: 'v1',
    },
    auth: {
      baseUrl: AUTH_BASE_PATH,
    },
    health: HEALTH_BASE_PATH,
    docs: {
      reference: DOCS_URL,
      openapi: OPENAPI_JSON_URL,
    },
  });
};

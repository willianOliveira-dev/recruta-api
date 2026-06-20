import type { LoggerService } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const REQUEST_ID_HEADER = 'x-request-id';

export const httpLoggerMiddleware =
  (logger: LoggerService) =>
  (request: Request, response: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();
    const requestId =
      request.header(REQUEST_ID_HEADER) ?? randomUUID().replaceAll('-', '');

    response.setHeader(REQUEST_ID_HEADER, requestId);

    response.on('finish', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const logPayload = {
        requestId,
        method: request.method,
        url: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        userAgent: request.header('user-agent'),
        ip: request.ip,
      };

      if (response.statusCode >= 500) {
        logger.error(logPayload, undefined, 'HTTP');
        return;
      }

      if (response.statusCode >= 400) {
        logger.warn(logPayload, 'HTTP');
        return;
      }

      logger.log(logPayload, 'HTTP');
    });

    next();
  };

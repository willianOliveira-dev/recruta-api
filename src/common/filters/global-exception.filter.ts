import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { ErrorResponseDto } from '../http/dto/error-response.dto';
import type { ValidationIssueDto } from '../http/dto/validation-issue.dto';
import type { AppLogger } from '../logger/app.logger';

type ExceptionResponseBody = {
  code?: string;
  error?: string;
  message?: string | string[];
  details?: ValidationIssueDto[];
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: AppLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode = this.getStatusCode(exception);
    const exceptionBody = this.getExceptionBody(exception);
    const responseBody: ErrorResponseDto = {
      success: false,
      error: {
        code: this.getErrorCode(statusCode, exceptionBody),
        message: this.getErrorMessage(statusCode, exceptionBody),
        ...(exceptionBody.details ? { details: exceptionBody.details } : {}),
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: httpAdapter.getRequestUrl(request),
        method: request.method,
        statusCode,
        requestId: response.getHeader('x-request-id')?.toString(),
      },
    };

    this.logException(exception, responseBody);
    httpAdapter.reply(response, responseBody, statusCode);
  }

  private getStatusCode(exception: unknown) {
    return exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getExceptionBody(exception: unknown): ExceptionResponseBody {
    if (!(exception instanceof HttpException)) {
      return {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      };
    }

    const response = exception.getResponse();

    if (typeof response === 'string') {
      return {
        code: this.toErrorCode(exception.name),
        message: response,
      };
    }

    return response as ExceptionResponseBody;
  }

  private getErrorCode(
    statusCode: number,
    exceptionBody: ExceptionResponseBody,
  ) {
    if (exceptionBody.code) {
      return exceptionBody.code;
    }

    if (exceptionBody.error) {
      return this.toErrorCode(exceptionBody.error);
    }

    return this.statusToErrorCode(statusCode);
  }

  private getErrorMessage(
    statusCode: number,
    exceptionBody: ExceptionResponseBody,
  ) {
    if (Array.isArray(exceptionBody.message)) {
      return exceptionBody.message.join('; ');
    }

    if (exceptionBody.message) {
      return exceptionBody.message;
    }

    if (exceptionBody.error) {
      return exceptionBody.error;
    }

    return statusCode >= 500 ? 'Internal server error' : 'Request failed';
  }

  private statusToErrorCode(statusCode: number) {
    const statusName = HttpStatus[statusCode] as string | undefined;
    return statusName ? this.toErrorCode(statusName) : 'HTTP_ERROR';
  }

  private toErrorCode(value: string) {
    return value
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }

  private logException(exception: unknown, responseBody: ErrorResponseDto) {
    if (responseBody.meta.statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(responseBody, stack, 'ExceptionFilter');
      return;
    }

    this.logger.warn(responseBody, 'ExceptionFilter');
  }
}

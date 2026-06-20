import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiDefaultResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  type ApiResponseOptions,
} from '@nestjs/swagger';
import { ApiErrorDto, ErrorResponseDto } from '../dto/error-response.dto';
import { HttpResponseMetaDto } from '../dto/http-response-meta.dto';
import { ValidationIssueDto } from '../dto/validation-issue.dto';

export type StandardErrorStatus =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 422
  | 429
  | 500
  | 'default';

const errorResponseOptionsByStatus: Record<
  StandardErrorStatus,
  ApiResponseOptions
> = {
  400: {
    description: 'Request validation or parsing failed.',
    type: ErrorResponseDto,
  },
  401: {
    description: 'Authentication is required or invalid.',
    type: ErrorResponseDto,
  },
  403: {
    description: 'Authenticated user does not have permission.',
    type: ErrorResponseDto,
  },
  404: {
    description: 'Resource was not found.',
    type: ErrorResponseDto,
  },
  409: {
    description: 'Request conflicts with current resource state.',
    type: ErrorResponseDto,
  },
  422: {
    description: 'Request is syntactically valid but semantically invalid.',
    type: ErrorResponseDto,
  },
  429: {
    description: 'Too many requests.',
    type: ErrorResponseDto,
  },
  500: {
    description: 'Unexpected internal server error.',
    type: ErrorResponseDto,
  },
  default: {
    description: 'Unexpected error.',
    type: ErrorResponseDto,
  },
};

const decoratorByStatus = {
  400: ApiBadRequestResponse,
  401: ApiUnauthorizedResponse,
  403: ApiForbiddenResponse,
  404: ApiNotFoundResponse,
  409: ApiConflictResponse,
  422: ApiUnprocessableEntityResponse,
  429: ApiTooManyRequestsResponse,
  500: ApiInternalServerErrorResponse,
  default: ApiDefaultResponse,
} satisfies Record<
  StandardErrorStatus,
  (options?: ApiResponseOptions) => MethodDecorator & ClassDecorator
>;

export const ApiStandardErrors = (
  statuses: StandardErrorStatus[] = [
    400,
    401,
    403,
    404,
    409,
    422,
    429,
    500,
    'default',
  ],
) =>
  applyDecorators(
    ApiExtraModels(
      ErrorResponseDto,
      ApiErrorDto,
      HttpResponseMetaDto,
      ValidationIssueDto,
    ),
    ...statuses.map((status) =>
      decoratorByStatus[status](errorResponseOptionsByStatus[status]),
    ),
  );

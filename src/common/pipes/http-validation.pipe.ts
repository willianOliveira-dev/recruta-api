import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { mapValidationErrors } from '../mappers/validation-error.mapper';

export const createHttpValidationPipe = () =>
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    validationError: {
      target: false,
      value: false,
    },
    exceptionFactory: (errors) =>
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: mapValidationErrors(errors),
      }),
  });

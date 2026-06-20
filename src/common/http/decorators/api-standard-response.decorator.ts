import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
  type ApiResponseOptions,
} from '@nestjs/swagger';
import {
  ApiStandardErrors,
  type StandardErrorStatus,
} from './api-standard-errors.decorator';
import { SuccessResponseDto } from '../dto/success-response.dto';

export interface ApiStandardResponseOptions {
  type: Type<unknown>;
  description?: string;
  isArray?: boolean;
  errors?: StandardErrorStatus[];
}

const buildDataSchema = (type: Type<unknown>, isArray?: boolean) => {
  const schema = { $ref: getSchemaPath(type) };

  if (!isArray) {
    return schema;
  }

  return {
    type: 'array',
    items: schema,
  };
};

export const ApiStandardResponse = ({
  type,
  description = 'Request completed successfully.',
  isArray = false,
  errors,
}: ApiStandardResponseOptions) =>
  applyDecorators(
    ApiExtraModels(SuccessResponseDto, type),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(SuccessResponseDto) },
          {
            properties: {
              data: buildDataSchema(type, isArray),
            },
          },
        ],
      },
    } satisfies ApiResponseOptions),
    ApiStandardErrors(errors),
  );

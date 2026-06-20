import type { ValidationError } from 'class-validator';
import type { ValidationIssueDto } from '../http/dto/validation-issue.dto';

export const mapValidationErrors = (
  errors: ValidationError[],
): ValidationIssueDto[] => flattenValidationErrors(errors);

const flattenValidationErrors = (
  errors: ValidationError[],
  parentPath?: string,
): ValidationIssueDto[] =>
  errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const messages = Object.values(error.constraints ?? {});
    const current = messages.length
      ? [
          {
            field: error.property,
            path,
            messages,
          },
        ]
      : [];

    return [...current, ...flattenValidationErrors(error.children ?? [], path)];
  });

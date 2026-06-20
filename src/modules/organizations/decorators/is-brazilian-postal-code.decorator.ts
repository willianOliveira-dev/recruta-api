import {
  registerDecorator,
  type ValidationOptions,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { isValidBrazilianPostalCode } from '../domain/brazilian-postal-code';

const validator: ValidatorConstraintInterface = {
  validate(value: unknown) {
    return typeof value === 'string' && isValidBrazilianPostalCode(value);
  },
  defaultMessage() {
    return 'postalCode must be a valid Brazilian postal code';
  },
};

export const IsBrazilianPostalCode =
  (validationOptions?: ValidationOptions): PropertyDecorator =>
  (target, propertyKey) => {
    registerDecorator({
      name: 'isBrazilianPostalCode',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: validationOptions,
      validator,
    });
  };

import {
  registerDecorator,
  type ValidationOptions,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { isValidCnpj } from '../domain/brazilian-company-document';

const validator: ValidatorConstraintInterface = {
  validate(value: unknown) {
    return typeof value === 'string' && isValidCnpj(value);
  },
  defaultMessage() {
    return 'cnpj must be a valid Brazilian CNPJ';
  },
};

export const IsBrazilianCnpj =
  (validationOptions?: ValidationOptions): PropertyDecorator =>
  (target, propertyKey) => {
    registerDecorator({
      name: 'isBrazilianCnpj',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: validationOptions,
      validator,
    });
  };

const POSTAL_CODE_LENGTH = 8;

export const normalizePostalCode = (value: string): string =>
  value.replace(/\D/g, '');

export const isValidBrazilianPostalCode = (value: string): boolean =>
  normalizePostalCode(value).length === POSTAL_CODE_LENGTH;

const CNPJ_LENGTH = 14;
const FIRST_CHECK_DIGIT_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_CHECK_DIGIT_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export const normalizeCnpj = (value: string): string =>
  value.replace(/\D/g, '');

const calculateCheckDigit = (digits: string, weights: number[]) => {
  const sum = weights.reduce(
    (total, weight, index) => total + Number(digits[index]) * weight,
    0,
  );
  const remainder = sum % 11;

  return remainder < 2 ? 0 : 11 - remainder;
};

export const isValidCnpj = (value: string): boolean => {
  const digits = normalizeCnpj(value);

  if (digits.length !== CNPJ_LENGTH || /^(\d)\1+$/.test(digits)) {
    return false;
  }

  const firstCheckDigit = calculateCheckDigit(
    digits.slice(0, 12),
    FIRST_CHECK_DIGIT_WEIGHTS,
  );
  const secondCheckDigit = calculateCheckDigit(
    digits.slice(0, 12) + firstCheckDigit.toString(),
    SECOND_CHECK_DIGIT_WEIGHTS,
  );

  return digits.endsWith(`${firstCheckDigit}${secondCheckDigit}`);
};

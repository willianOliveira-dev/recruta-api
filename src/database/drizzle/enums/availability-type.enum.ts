import { pgEnum } from 'drizzle-orm/pg-core';

export const availabilityTypeEnum = pgEnum('availability_type', [
  'immediate',
  'one_week',
  'two_weeks',
  'one_month',
  'more_than_one_month',
  'unavailable',
]);

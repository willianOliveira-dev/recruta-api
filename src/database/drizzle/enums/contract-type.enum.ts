import { pgEnum } from 'drizzle-orm/pg-core';

export const contractTypeEnum = pgEnum('contract_type', [
  'clt',
  'pj',
  'internship',
  'temporary',
  'freelance',
]);

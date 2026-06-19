import { pgEnum } from 'drizzle-orm/pg-core';

export const workModePreferenceEnum = pgEnum('work_mode_preference', [
  'remote',
  'hybrid',
  'onsite',
  'flexible',
]);

import { pgEnum } from 'drizzle-orm/pg-core';

export const seniorityLevelEnum = pgEnum('seniority_level', [
  'internship',
  'junior',
  'mid_level',
  'senior',
  'specialist',
  'lead',
  'manager',
]);

import { pgEnum } from 'drizzle-orm/pg-core';

export const workModeEnum = pgEnum('work_mode', ['remote', 'hybrid', 'onsite']);

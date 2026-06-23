import { pgEnum } from 'drizzle-orm/pg-core';

export const planEnum = pgEnum('plan', ['basic', 'plus', 'pro']);

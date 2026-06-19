import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

export const uuidv7Default = sql`uuidv7()`;

export const uuidv7 = (name: string) => uuid(name).default(uuidv7Default);

export const uuidv7PrimaryKey = (name = 'id') => uuidv7(name).primaryKey();

export const timestampUtc = (name: string) =>
  timestamp(name, { withTimezone: true });

export const createdAt = (name = 'created_at') =>
  timestampUtc(name).defaultNow().notNull();

export const updatedAt = (name = 'updated_at') =>
  timestampUtc(name)
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

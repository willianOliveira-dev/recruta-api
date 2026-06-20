import { timestamp, uuid } from 'drizzle-orm/pg-core';
import { v7 as uuidv7Value } from 'uuid';

export const EMBEDDING_DIMENSIONS = 1536;

export const uuidv7 = (name: string) => uuid(name).$defaultFn(uuidv7Value);

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

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env.schema';
import * as schema from '../database/drizzle/schema';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  options: '-c timezone=UTC',
});

export const database = drizzle(pool, { schema });

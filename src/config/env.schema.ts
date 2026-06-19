import 'dotenv/config.js';
import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string(),
  PORT: z.coerce.number().default(3000),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_SECRET_ID: z.string(),
  BETTER_AUTH_URL: z.string().url(),
  ALLOWED_TRUSTED_ORIGINS: z
    .string()
    .transform((value) => value.trim().split(',')),
});

export const env = envSchema.parse(process.env);

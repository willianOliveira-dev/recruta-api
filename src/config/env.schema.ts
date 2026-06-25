import 'dotenv/config.js';
import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string(),
  PORT: z.coerce.number().default(3000),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_SECRET_ID: z.string(),
  BETTER_AUTH_URL: z.string().url(),
  MERCADO_PAGO_ACCESS_TOKEN: z.string(),
  MERCADO_PAGO_WEBHOOK_SECRET: z.string(),
  MERCADO_PAGO_BACK_URL: z.string().url(),
  MERCADO_PAGO_WEBHOOK_URL: z.string().url(),
  R2_ACCOUNT_ID: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_BUCKET: z.string(),
  R2_REGION: z.string().default('auto'),
  TURNSTILE_SITE_KEY: z.string(),
  TURNSTILE_SECRET_KEY: z.string(),
  CANDIDATE_RESUME_MAX_FILE_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  CANDIDATE_RESUME_UPLOAD_URL_EXPIRES_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(3600)
    .default(600),
  CANDIDATE_RESUME_ACCESS_URL_EXPIRES_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(3600)
    .default(300),
  RABBITMQ_URL: z.string().url().optional(),
  RABBITMQ_DOMAIN_EXCHANGE: z.string().default('recruta.domain'),
  RABBITMQ_AI_EXCHANGE: z.string().default('recruta.ai'),
  AI_RESULTS_SHARED_SECRET: z.string(),
  OUTBOX_PUBLISH_SHARED_SECRET: z.string(),
  ALLOWED_TRUSTED_ORIGINS: z
    .string()
    .transform((value) => value.trim().split(',')),
});

export const env = envSchema.parse(process.env);

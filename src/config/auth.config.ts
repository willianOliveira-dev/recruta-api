import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { env } from '../config/env.schema';
import { database } from '../config/database.config';
import { localization } from 'better-auth-localization';
import { openAPI, organization } from 'better-auth/plugins';
import { v7 as uuidv7 } from 'uuid';
import { AUTH_BASE_PATH } from './api-routes.config';
import * as schema from '../database/drizzle/schema';

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  basePath: AUTH_BASE_PATH,
  database: drizzleAdapter(database, {
    provider: 'pg',
    schema,
  }),
  advanced: {
    database: {
      generateId: () => uuidv7(),
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_SECRET_ID,
    },
  },
  trustedOrigins: env.ALLOWED_TRUSTED_ORIGINS,
  plugins: [
    localization({
      defaultLocale: 'pt-BR',
    }),
    organization(),
    openAPI(),
  ],
});

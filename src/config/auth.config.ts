import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { createAuthMiddleware, isAPIError } from 'better-auth/api';
import { env } from '../config/env.schema';
import { database } from '../config/database.config';
import { localization } from 'better-auth-localization';
import { openAPI, organization } from 'better-auth/plugins';
import { v7 as uuidv7 } from 'uuid';
import { AUTH_BASE_PATH } from './api-routes.config';
import * as schema from '../database/drizzle/schema';
import { AuthSecurityService } from '../modules/auth/services/auth-security.service';
import { TurnstileService } from '../modules/auth/services/turnstile.service';

const authSecurityService = new AuthSecurityService(
  database,
  new TurnstileService(),
);

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
  rateLimit: {
    enabled: false,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-in/email') {
        await authSecurityService.assertLoginAllowed(ctx);
        return;
      }

      if (ctx.path === '/sign-up/email') {
        await authSecurityService.assertAuthRequestAllowed(ctx, 'sign-up');
        await authSecurityService.assertTurnstile(ctx);
        return;
      }

      if (ctx.path === '/request-password-reset') {
        await authSecurityService.assertAuthRequestAllowed(
          ctx,
          'request-password-reset',
        );
        await authSecurityService.assertTurnstile(ctx);
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-in/email') {
        return;
      }

      const returned = ctx.context.returned;
      const succeeded = !isAPIError(returned);
      const failedByInvalidCredentials =
        isAPIError(returned) && returned.statusCode === 401;

      if (succeeded || failedByInvalidCredentials) {
        await authSecurityService.recordLoginResult(ctx, succeeded);
      }
    }),
  },
  plugins: [
    localization({
      defaultLocale: 'pt-BR',
    }),
    organization(),
    openAPI(),
  ],
});

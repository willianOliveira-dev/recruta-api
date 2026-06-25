import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { eq, sql } from 'drizzle-orm';
import { APIError } from 'better-auth';
import {
  authLoginAttempt,
  authRateLimitBucket,
} from '../../../database/drizzle/schema';
import { DRIZZLE } from '../../../database/drizzle/drizzle.module';
import type { database } from '../../../config/database.config';
import { TurnstileService } from './turnstile.service';

type Database = typeof database;

type AuthRequestLike = {
  headers?: Headers;
  request?: globalThis.Request | ExpressRequest;
  body?: unknown;
};

type LoginAttemptRecord = typeof authLoginAttempt.$inferSelect;

const LOGIN_FAILED_ATTEMPTS_LIMIT = 5;
const LOGIN_FAILED_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const IP_RATE_LIMIT_MAX_REQUESTS = 5;

export class AuthSecurityService {
  constructor(
    private readonly db: Database,
    private readonly turnstileService: TurnstileService,
  ) {}

  async assertAuthRequestAllowed(input: AuthRequestLike, action: string) {
    const ip = this.getClientIp(input);
    await this.assertIpRateLimit(action, ip);
  }

  async assertLoginAllowed(input: AuthRequestLike) {
    await this.assertAuthRequestAllowed(input, 'login');

    const emailKey = this.getEmailKey(input.body);
    if (!emailKey) {
      return;
    }

    const attempt = await this.findLoginAttempt(emailKey);
    if (!attempt) {
      return;
    }

    const now = new Date();
    if (this.isBlocked(attempt, now)) {
      throw this.tooManyRequestsApiError();
    }

    if (this.hasExpiredFailureWindow(attempt, now)) {
      await this.clearLoginAttempt(emailKey);
      return;
    }

    if (!attempt.turnstileRequired) {
      return;
    }

    await this.assertTurnstile(input);
  }

  async recordLoginResult(input: AuthRequestLike, succeeded: boolean) {
    const emailKey = this.getEmailKey(input.body);
    if (!emailKey) {
      return;
    }

    if (succeeded) {
      await this.clearLoginAttempt(emailKey);
      return;
    }

    await this.recordFailedLogin(emailKey);
  }

  async assertTurnstile(input: AuthRequestLike) {
    const token = this.getTurnstileToken(input);
    const isValid = await this.turnstileService.verify(
      token,
      this.getClientIp(input),
    );

    if (!isValid) {
      throw new APIError('FORBIDDEN', {
        code: 'TURNSTILE_VERIFICATION_FAILED',
        message: 'Verificacao anti-bot obrigatoria',
      });
    }
  }

  async assertNestTurnstile(request: ExpressRequest) {
    const token = this.getRequestHeader(request, 'x-captcha-response');
    const isValid = await this.turnstileService.verify(
      token,
      this.getNestClientIp(request),
    );

    if (!isValid) {
      throw new BadRequestException({
        code: 'TURNSTILE_VERIFICATION_FAILED',
        message: 'Verificacao anti-bot obrigatoria',
      });
    }
  }

  private async assertIpRateLimit(action: string, ip?: string | null) {
    const key = `auth:${action}:ip:${ip ?? 'unknown'}`;
    const [bucket] = await this.db
      .insert(authRateLimitBucket)
      .values({
        key,
        count: 1,
        windowStartedAt: sql`now()`,
        expiresAt: sql`now() + interval '60 seconds'`,
      })
      .onConflictDoUpdate({
        target: authRateLimitBucket.key,
        set: {
          count: sql`
            case
              when ${authRateLimitBucket.windowStartedAt} <= now() - interval '60 seconds'
                then 1
              else ${authRateLimitBucket.count} + 1
            end
          `,
          windowStartedAt: sql`
            case
              when ${authRateLimitBucket.windowStartedAt} <= now() - interval '60 seconds'
                then now()
              else ${authRateLimitBucket.windowStartedAt}
            end
          `,
          expiresAt: sql`now() + interval '60 seconds'`,
          updatedAt: sql`now()`,
        },
      })
      .returning({
        count: authRateLimitBucket.count,
      });

    if ((bucket?.count ?? 0) <= IP_RATE_LIMIT_MAX_REQUESTS) {
      return;
    }

    throw this.tooManyRequestsApiError();
  }

  private async recordFailedLogin(emailKey: string) {
    const now = new Date();
    const attempt = await this.findLoginAttempt(emailKey);

    if (!attempt || this.hasExpiredFailureWindow(attempt, now)) {
      await this.db
        .insert(authLoginAttempt)
        .values({
          emailKey,
          failedCount: 1,
          firstFailedAt: now,
          lastFailedAt: now,
          blockedUntil: null,
          turnstileRequired: false,
        })
        .onConflictDoUpdate({
          target: authLoginAttempt.emailKey,
          set: {
            failedCount: 1,
            firstFailedAt: now,
            lastFailedAt: now,
            blockedUntil: null,
            turnstileRequired: false,
            updatedAt: now,
          },
        });
      return;
    }

    const failedCount = attempt.failedCount + 1;
    await this.db
      .update(authLoginAttempt)
      .set({
        failedCount,
        lastFailedAt: now,
        blockedUntil:
          failedCount >= LOGIN_FAILED_ATTEMPTS_LIMIT
            ? new Date(now.getTime() + LOGIN_BLOCK_MS)
            : attempt.blockedUntil,
        turnstileRequired:
          failedCount >= LOGIN_FAILED_ATTEMPTS_LIMIT ||
          attempt.turnstileRequired,
        updatedAt: now,
      })
      .where(eq(authLoginAttempt.emailKey, emailKey));
  }

  private async clearLoginAttempt(emailKey: string) {
    await this.db
      .delete(authLoginAttempt)
      .where(eq(authLoginAttempt.emailKey, emailKey));
  }

  private async findLoginAttempt(emailKey: string) {
    const [attempt] = await this.db
      .select()
      .from(authLoginAttempt)
      .where(eq(authLoginAttempt.emailKey, emailKey))
      .limit(1);

    return attempt;
  }

  private hasExpiredFailureWindow(
    attempt: LoginAttemptRecord,
    now: Date,
  ): boolean {
    return now.getTime() - attempt.firstFailedAt.getTime() > LOGIN_FAILED_WINDOW_MS;
  }

  private isBlocked(attempt: LoginAttemptRecord, now: Date) {
    return Boolean(attempt.blockedUntil && attempt.blockedUntil > now);
  }

  private getEmailKey(body: unknown) {
    if (!body || typeof body !== 'object' || !Object.hasOwn(body, 'email')) {
      return null;
    }

    const email = (body as { email?: unknown }).email;
    return typeof email === 'string' ? email.trim().toLocaleLowerCase() : null;
  }

  private getTurnstileToken(input: AuthRequestLike) {
    return (
      this.getHeadersToken(input.headers) ??
      this.getNestHeadersToken(input.request) ??
      null
    );
  }

  private getHeadersToken(headers?: Headers) {
    return headers?.get('x-captcha-response') ?? null;
  }

  private getNestHeadersToken(request?: AuthRequestLike['request']) {
    return this.isExpressRequest(request)
      ? this.getRequestHeader(request, 'x-captcha-response')
      : null;
  }

  private getClientIp(input: AuthRequestLike) {
    return (
      this.getHeader(input.headers, 'cf-connecting-ip') ??
      this.getHeader(input.headers, 'x-forwarded-for')?.split(',')[0]?.trim() ??
      this.getNestClientIp(input.request) ??
      null
    );
  }

  private getNestClientIp(request?: AuthRequestLike['request']) {
    if (!this.isExpressRequest(request)) {
      return null;
    }

    return (
      this.getRequestHeader(request, 'cf-connecting-ip') ??
      this.getRequestHeader(request, 'x-forwarded-for')?.split(',')[0]?.trim() ??
      request.ip ??
      null
    );
  }

  private getHeader(headers: Headers | undefined, key: string) {
    return headers?.get(key) ?? null;
  }

  private getRequestHeader(request: ExpressRequest, key: string) {
    const value = request.header(key);
    return value && value.trim().length > 0 ? value.trim() : null;
  }

  private isExpressRequest(
    request?: AuthRequestLike['request'],
  ): request is ExpressRequest {
    return Boolean(
      request &&
        typeof request === 'object' &&
        'header' in request &&
        typeof request.header === 'function',
    );
  }

  private tooManyRequestsApiError() {
    return new APIError('TOO_MANY_REQUESTS', {
      code: 'AUTH_TOO_MANY_ATTEMPTS',
      message: 'Muitas tentativas. Tente novamente em 15 minutos.',
    });
  }
}

@Injectable()
export class NestAuthSecurityService extends AuthSecurityService {
  constructor(
    @Inject(DRIZZLE) db: Database,
    turnstileService: TurnstileService,
  ) {
    super(db, turnstileService);
  }
}

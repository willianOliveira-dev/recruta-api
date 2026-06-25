import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { env } from '../../../config/env.schema';

type TurnstileVerificationResponse = {
  success: boolean;
  hostname?: string;
  action?: string;
  'error-codes'?: string[];
};

@Injectable()
export class TurnstileService {
  private readonly siteverifyUrl =
    'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  async verify(token: string | null, remoteIp?: string | null) {
    if (!token || token.trim().length === 0 || token.length > 2048) {
      return false;
    }

    const response = await fetch(this.siteverifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        idempotency_key: randomUUID(),
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });

    if (!response.ok) {
      return false;
    }

    const result = (await response.json()) as TurnstileVerificationResponse;
    return result.success === true;
  }
}

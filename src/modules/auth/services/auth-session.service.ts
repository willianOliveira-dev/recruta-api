import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { auth } from '../../../config/auth.config';
import type { AuthenticatedSession } from '../types/authenticated-request';

@Injectable()
export class AuthSessionService {
  async getSession(request: Request): Promise<AuthenticatedSession | null> {
    const session = await auth.api.getSession({
      headers: this.toHeaders(request),
    });

    return session;
  }

  private toHeaders(request: Request): Headers {
    const headers = new Headers();

    Object.entries(request.headers).forEach(([key, value]) => {
      if (!value) {
        return;
      }

      headers.set(key, Array.isArray(value) ? value.join(',') : value);
    });

    return headers;
  }
}

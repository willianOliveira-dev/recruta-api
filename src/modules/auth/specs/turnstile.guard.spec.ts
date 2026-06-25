import type { ExecutionContext } from '@nestjs/common';

jest.mock('../services/auth-security.service', () => ({
  NestAuthSecurityService: class NestAuthSecurityService {},
}));

import { TurnstileGuard } from '../guards/turnstile.guard';
import type { NestAuthSecurityService } from '../services/auth-security.service';

const makeContext = (request: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as ExecutionContext;

describe('TurnstileGuard', () => {
  it('allows the request after Turnstile verification succeeds', async () => {
    const authSecurityService = {
      assertNestTurnstile: jest.fn().mockResolvedValue(undefined),
    };
    const request = {
      header: jest.fn(),
    };
    const guard = new TurnstileGuard(
      authSecurityService as unknown as NestAuthSecurityService,
    );

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);

    expect(authSecurityService.assertNestTurnstile).toHaveBeenCalledWith(
      request,
    );
  });

  it('rejects the request when Turnstile verification fails', async () => {
    const error = new Error('turnstile failed');
    const authSecurityService = {
      assertNestTurnstile: jest.fn().mockRejectedValue(error),
    };
    const guard = new TurnstileGuard(
      authSecurityService as unknown as NestAuthSecurityService,
    );

    await expect(guard.canActivate(makeContext({}))).rejects.toBe(error);
  });
});

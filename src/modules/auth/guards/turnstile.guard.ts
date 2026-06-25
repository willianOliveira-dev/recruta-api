import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { NestAuthSecurityService } from '../services/auth-security.service';

@Injectable()
export class TurnstileGuard implements CanActivate {
  constructor(private readonly authSecurityService: NestAuthSecurityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    await this.authSecurityService.assertNestTurnstile(request);
    return true;
  }
}

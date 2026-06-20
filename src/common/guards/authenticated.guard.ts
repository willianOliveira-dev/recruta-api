import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthSessionService } from '../../modules/auth/services/auth-session.service';
import type { AuthenticatedRequest } from '../../modules/auth/types/authenticated-request';

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(private readonly authSessionService: AuthSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await this.authSessionService.getSession(request);

    if (!session) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required',
      });
    }

    request.authSession = session;
    return true;
  }
}

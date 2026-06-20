import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedRequest,
  AuthenticatedSession,
} from '../../modules/auth/types/authenticated-request';

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedSession => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.authSession) {
      throw new Error('Authenticated session is not available');
    }

    return request.authSession;
  },
);

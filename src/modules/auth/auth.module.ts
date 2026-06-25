import { Module } from '@nestjs/common';
import { AuthenticatedGuard } from '../../common/guards/authenticated.guard';
import { TurnstileGuard } from './guards/turnstile.guard';
import {
  NestAuthSecurityService,
  AuthSecurityService,
} from './services/auth-security.service';
import { AuthSessionService } from './services/auth-session.service';
import { TurnstileService } from './services/turnstile.service';

@Module({
  providers: [
    AuthSessionService,
    AuthenticatedGuard,
    TurnstileGuard,
    TurnstileService,
    NestAuthSecurityService,
    {
      provide: AuthSecurityService,
      useExisting: NestAuthSecurityService,
    },
  ],
  exports: [
    AuthSessionService,
    AuthenticatedGuard,
    TurnstileGuard,
    TurnstileService,
    NestAuthSecurityService,
    AuthSecurityService,
  ],
})
export class AuthModule {}

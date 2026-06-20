import { Module } from '@nestjs/common';
import { AuthenticatedGuard } from '../../common/guards/authenticated.guard';
import { AuthSessionService } from './services/auth-session.service';

@Module({
  providers: [AuthSessionService, AuthenticatedGuard],
  exports: [AuthSessionService, AuthenticatedGuard],
})
export class AuthModule {}

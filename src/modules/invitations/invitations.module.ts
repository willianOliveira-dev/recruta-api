import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MembersModule } from '../members/members.module';
import { InvitationsController } from './controllers/invitations.controller';
import { InvitationsRepository } from './repositories/invitations.repository';
import { InvitationsService } from './services/invitations.service';

@Module({
  imports: [AuthModule, MembersModule],
  controllers: [InvitationsController],
  providers: [InvitationsRepository, InvitationsService],
})
export class InvitationsModule {}

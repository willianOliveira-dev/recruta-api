import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logger/logger.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { MembersModule } from './modules/members/members.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';

@Module({
  imports: [
    LoggerModule,
    DatabaseModule,
    HealthModule,
    OrganizationsModule,
    MembersModule,
    InvitationsModule,
  ],
})
export class AppModule {}

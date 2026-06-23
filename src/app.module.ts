import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logger/logger.module';
import { DatabaseModule } from './database/database.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { HealthModule } from './modules/health/health.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { MembersModule } from './modules/members/members.module';
import { OrganizationSubscriptionsModule } from './modules/organization-subscriptions/organization-subscriptions.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { SubscriptionPlansModule } from './modules/subscription-plans/subscription-plans.module';

@Module({
  imports: [
    LoggerModule,
    DatabaseModule,
    HealthModule,
    OrganizationsModule,
    MembersModule,
    InvitationsModule,
    SubscriptionPlansModule,
    OrganizationSubscriptionsModule,
    JobsModule,
    CandidatesModule,
  ],
})
export class AppModule {}

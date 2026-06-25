import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logger/logger.module';
import { DatabaseModule } from './database/database.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AiResultsModule } from './modules/ai-results/ai-results.module';
import { AuditModule } from './modules/audit/audit.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { HealthModule } from './modules/health/health.module';
import { InterviewNotesModule } from './modules/interview-notes/interview-notes.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { MembersModule } from './modules/members/members.module';
import { OrganizationSubscriptionsModule } from './modules/organization-subscriptions/organization-subscriptions.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
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
    ApplicationsModule,
    PipelineModule,
    InterviewNotesModule,
    AuditModule,
    OutboxModule,
    AiResultsModule,
  ],
})
export class AppModule {}

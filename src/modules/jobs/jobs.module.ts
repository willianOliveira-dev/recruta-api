import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module';
import { JobsController } from './controllers/jobs.controller';
import { JobsRepository } from './repositories/jobs.repository';
import { JobsService } from './services/jobs.service';

@Module({
  imports: [AuthModule, SubscriptionPlansModule],
  controllers: [JobsController],
  providers: [JobsService, JobsRepository],
})
export class JobsModule {}

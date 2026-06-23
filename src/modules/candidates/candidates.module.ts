import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module';
import { CandidatesController } from './controllers/candidates.controller';
import { CandidateResumeFilesRepository } from './repositories/candidate-resume-files.repository';
import { CandidatesRepository } from './repositories/candidates.repository';
import { CandidateResumeFilesService } from './services/candidate-resume-files.service';
import { CandidateResumeStorageService } from './services/candidate-resume-storage.service';
import { CandidatesService } from './services/candidates.service';

@Module({
  imports: [AuthModule, SubscriptionPlansModule],
  controllers: [CandidatesController],
  providers: [
    CandidatesService,
    CandidateResumeFilesService,
    CandidateResumeStorageService,
    CandidatesRepository,
    CandidateResumeFilesRepository,
  ],
})
export class CandidatesModule {}

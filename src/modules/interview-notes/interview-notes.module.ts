import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InterviewNotesController } from './controllers/interview-notes.controller';
import { InterviewNotesRepository } from './repositories/interview-notes.repository';
import { InterviewNotesService } from './services/interview-notes.service';

@Module({
  imports: [AuthModule],
  controllers: [InterviewNotesController],
  providers: [InterviewNotesService, InterviewNotesRepository],
})
export class InterviewNotesModule {}

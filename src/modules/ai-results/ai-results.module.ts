import { Module } from '@nestjs/common';
import { AiResultsController } from './controllers/ai-results.controller';
import { AiResultsRepository } from './repositories/ai-results.repository';
import { AiResultsService } from './services/ai-results.service';

@Module({
  controllers: [AiResultsController],
  providers: [AiResultsRepository, AiResultsService],
  exports: [AiResultsService],
})
export class AiResultsModule {}

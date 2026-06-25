import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PipelineController } from './controllers/pipeline.controller';
import { PipelineRepository } from './repositories/pipeline.repository';
import { PipelineService } from './services/pipeline.service';

@Module({
  imports: [AuthModule],
  controllers: [PipelineController],
  providers: [PipelineService, PipelineRepository],
})
export class PipelineModule {}

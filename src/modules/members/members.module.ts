import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MembersController } from './controllers/members.controller';
import { MembersRepository } from './repositories/members.repository';
import { MembersService } from './services/members.service';

@Module({
  imports: [AuthModule],
  controllers: [MembersController],
  providers: [MembersRepository, MembersService],
  exports: [MembersService],
})
export class MembersModule {}

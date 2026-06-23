import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module';
import { MembersController } from './controllers/members.controller';
import { MembersRepository } from './repositories/members.repository';
import { MembersService } from './services/members.service';

@Module({
  imports: [AuthModule, SubscriptionPlansModule],
  controllers: [MembersController],
  providers: [MembersRepository, MembersService],
  exports: [MembersService],
})
export class MembersModule {}

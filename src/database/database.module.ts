import { Global, Module } from '@nestjs/common';
import { DrizzleModule } from './drizzle/drizzle.module';

@Global()
@Module({
  imports: [DrizzleModule],
  exports: [DrizzleModule],
})
export class DatabaseModule {}

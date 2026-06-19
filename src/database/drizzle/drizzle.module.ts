import { Global, Module } from '@nestjs/common';
import { database } from '../../config/database.config';

export const DRIZZLE = Symbol('DRIZZLE');

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useValue: database,
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}

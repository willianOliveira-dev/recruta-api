import { Global, Module } from '@nestjs/common';
import { AppLogger } from './app.logger';
import { APP_LOGGER } from './logger.tokens';

@Global()
@Module({
  providers: [AppLogger, { provide: APP_LOGGER, useExisting: AppLogger }],
  exports: [APP_LOGGER, AppLogger],
})
export class LoggerModule {}

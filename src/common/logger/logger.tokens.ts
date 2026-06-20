import type { LoggerService } from '@nestjs/common';

export const APP_LOGGER = Symbol('APP_LOGGER');

export type ApplicationLogger = Pick<LoggerService, 'log' | 'warn' | 'error'>;

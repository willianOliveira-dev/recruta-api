import type { LoggerService } from '@nestjs/common';
import pino, { type Logger as PinoLogger } from 'pino';

type PinoNestLevel = 'debug' | 'error' | 'fatal' | 'info' | 'trace' | 'warn';

const isProduction = process.env.NODE_ENV === 'production';

const createPinoLogger = () =>
  pino({
    level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(isProduction
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              ignore: 'pid,hostname',
              messageFormat: '[{context}] {msg}',
              singleLine: false,
              translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            },
          },
        }),
  });

export class AppLogger implements LoggerService {
  private readonly logger: PinoLogger;

  constructor(private readonly context = 'RecrutaAPI') {
    this.logger = createPinoLogger();
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.write('info', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]) {
    this.write('fatal', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.write('trace', message, optionalParams);
  }

  private write(
    level: PinoNestLevel,
    message: unknown,
    optionalParams: unknown[],
  ) {
    const { context, trace } = this.resolveParams(optionalParams);
    const payload = {
      context,
      ...(trace ? { trace } : {}),
    };

    if (typeof message === 'string') {
      this.logger[level](payload, message);
      return;
    }

    this.logger[level](
      {
        ...payload,
        data: message,
      },
      'log',
    );
  }

  private resolveParams(optionalParams: unknown[]) {
    const stringParams = optionalParams.filter(
      (param): param is string => typeof param === 'string',
    );

    return {
      context: stringParams.at(-1) ?? this.context,
      trace: stringParams.length > 1 ? stringParams[0] : undefined,
    };
  }
}

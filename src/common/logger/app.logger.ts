import { Injectable, type LoggerService } from '@nestjs/common';
import pino from 'pino';

type PinoNestLevel = 'debug' | 'error' | 'fatal' | 'info' | 'trace' | 'warn';
type LogPayload = Record<string, unknown>;
type PinoLogWriter = (payload: LogPayload, message: string) => void;
type PinoLoggerPort = Record<PinoNestLevel, PinoLogWriter>;
interface PinoModulePort {
  (options: Record<string, unknown>): PinoLoggerPort;
  stdTimeFunctions: {
    isoTime: () => string;
  };
}

const isProduction = process.env.NODE_ENV === 'production';
const pinoModule = pino as unknown as PinoModulePort;

const createPinoLogger = (): PinoLoggerPort =>
  pinoModule({
    level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
    base: undefined,
    timestamp: pinoModule.stdTimeFunctions.isoTime,
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

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger: PinoLoggerPort;
  private readonly context = 'RecrutaAPI';

  constructor() {
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

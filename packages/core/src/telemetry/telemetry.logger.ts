import { ConsoleLogger, type LogLevel as NestLogLevel } from '@nestjs/common';
import type { LogLevel, Telemetry } from '@recuidado/telemetry';

const LEVELS: Record<NestLogLevel, LogLevel> = {
  verbose: 'debug',
  debug: 'debug',
  log: 'info',
  warn: 'warn',
  error: 'error',
  fatal: 'fatal',
};

/**
 * Nest logger that keeps printing to the console and also ships every line to
 * PostHog Logs, so logs survive container restarts and redeploys.
 */
export class TelemetryLogger extends ConsoleLogger {
  constructor(private readonly telemetry: Telemetry) {
    super();
  }

  protected override printMessages(
    messages: unknown[],
    context = '',
    logLevel: NestLogLevel = 'log',
    writeStreamType?: 'stdout' | 'stderr',
    errorStack?: unknown,
  ): void {
    super.printMessages(
      messages,
      context,
      logLevel,
      writeStreamType,
      errorStack,
    );
    for (const message of messages) {
      const text =
        message instanceof Error
          ? message.message
          : typeof message === 'string'
            ? message
            : JSON.stringify(message);
      this.telemetry.log(LEVELS[logLevel], text, {
        context: context || undefined,
        stack: typeof errorStack === 'string' ? errorStack : undefined,
      });
    }
  }
}

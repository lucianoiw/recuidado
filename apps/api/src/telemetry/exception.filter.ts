import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';
import { telemetry } from '@recuidado/core';

/** Sends unexpected errors (5xx and non-HTTP) to PostHog error tracking, then answers as Nest does. */
@Catch()
export class TelemetryExceptionFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost) {
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500) {
      const req =
        host.getType() === 'http'
          ? host.switchToHttp().getRequest<Request>()
          : undefined;
      telemetry.captureException(
        exception,
        {
          http_method: req?.method,
          http_path: req?.path,
          http_status: status,
          $session_id: req?.get('x-posthog-session-id'),
        },
        req?.get('x-posthog-distinct-id') || undefined,
      );
    }
    super.catch(exception, host);
  }
}

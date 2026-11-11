import type { NextFunction, Request, Response } from 'express';
import type { Telemetry } from '@recuidado/telemetry';

/** One log line per HTTP request: method, route, status and duration. */
export function accessLog(telemetry: Telemetry) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      if (req.path === '/health') return;
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const status = res.statusCode;
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      telemetry.log(
        level,
        `${req.method} ${req.originalUrl} ${status} ${durationMs.toFixed(0)}ms`,
        {
          'http.method': req.method,
          'http.route':
            (req.route as { path?: string } | undefined)?.path ?? req.path,
          'http.target': req.originalUrl,
          'http.status_code': status,
          'http.duration_ms': Math.round(durationMs),
          'http.user_agent': req.get('user-agent'),
          'http.origin': req.get('origin'),
          // Sent by posthog-js (tracing_headers): links this line to the session replay.
          sessionId: req.get('x-posthog-session-id'),
          posthogDistinctId: req.get('x-posthog-distinct-id'),
        },
      );
    });
    next();
  };
}

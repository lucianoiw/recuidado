export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type LogAttributes = Record<string, string | number | boolean | null | undefined>;

interface LogRecord {
  timeUnixNano: string;
  severityNumber: number;
  severityText: string;
  body: { stringValue: string };
  attributes: OtlpAttribute[];
}

interface OtlpAttribute {
  key: string;
  value: { stringValue: string } | { intValue: string } | { doubleValue: number } | { boolValue: boolean };
}

// OpenTelemetry severity numbers: https://opentelemetry.io/docs/specs/otel/logs/data-model/#severity-fields
const SEVERITY: Record<LogLevel, number> = { debug: 5, info: 9, warn: 13, error: 17, fatal: 21 };

export function toOtlpAttributes(attributes: LogAttributes): OtlpAttribute[] {
  const out: OtlpAttribute[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "boolean") out.push({ key, value: { boolValue: value } });
    else if (typeof value === "number")
      out.push({ key, value: Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value } });
    else out.push({ key, value: { stringValue: value } });
  }
  return out;
}

export interface OtlpLogExporterOptions {
  /** Full OTLP/HTTP logs URL, e.g. https://us.i.posthog.com/i/v1/logs */
  url: string;
  token: string;
  resource: LogAttributes;
  /** Flush when this many records are buffered. */
  maxBatch?: number;
  flushIntervalMs?: number;
  fetch?: typeof fetch;
}

/**
 * Batches log records and sends them as OTLP/HTTP JSON. Small on purpose: the
 * services only need fire-and-forget logs, not the full OpenTelemetry SDK.
 */
export class OtlpLogExporter {
  private buffer: LogRecord[] = [];
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<void> = Promise.resolve();
  private readonly maxBatch: number;
  private readonly flushIntervalMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opts: OtlpLogExporterOptions) {
    this.maxBatch = opts.maxBatch ?? 100;
    this.flushIntervalMs = opts.flushIntervalMs ?? 2000;
    this.fetchFn = opts.fetch ?? fetch;
  }

  emit(level: LogLevel, message: string, attributes: LogAttributes = {}, time = new Date()): void {
    this.buffer.push({
      timeUnixNano: `${BigInt(time.getTime()) * 1_000_000n}`,
      severityNumber: SEVERITY[level],
      severityText: level.toUpperCase(),
      body: { stringValue: message },
      attributes: toOtlpAttributes(attributes),
    });
    if (this.buffer.length >= this.maxBatch) void this.flush();
    else if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), this.flushIntervalMs);
      this.timer.unref?.();
    }
  }

  /** Sends what is buffered. Never throws: losing a log must not break the service. */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.buffer.length === 0) return this.inFlight;
    const records = this.buffer;
    this.buffer = [];
    const body = JSON.stringify({
      resourceLogs: [
        {
          resource: { attributes: toOtlpAttributes(this.opts.resource) },
          scopeLogs: [{ scope: { name: "@recuidado/telemetry" }, logRecords: records }],
        },
      ],
    });
    this.inFlight = this.inFlight.then(async () => {
      try {
        const res = await this.fetchFn(this.opts.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.opts.token}` },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) process.stderr.write(`telemetry: logs export answered ${res.status}\n`);
      } catch (err) {
        process.stderr.write(`telemetry: logs export failed: ${(err as Error).message}\n`);
      }
    });
    return this.inFlight;
  }
}

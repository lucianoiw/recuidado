import { PostHog } from "posthog-node";
import { OtlpLogExporter, type LogAttributes, type LogLevel } from "./otlp-logs.ts";

export { OtlpLogExporter, toOtlpAttributes, type LogAttributes, type LogLevel } from "./otlp-logs.ts";

export type Properties = Record<string, unknown>;

export interface TelemetryOptions {
  /** Service name shown in PostHog Logs and on every event (api, voice). */
  service: string;
  /** PostHog project token (phc_...). Without it every call is a no-op. */
  token?: string;
  /** Ingestion host. Defaults to PostHog US cloud. */
  host?: string;
  environment?: string;
  version?: string;
  /** Also print logs to stdout/stderr (Coolify keeps them only while the container lives). */
  console?: boolean;
  fetch?: typeof fetch;
}

/** One LLM call, sent as a PostHog `$ai_generation` event (LLM analytics). */
export interface LlmGeneration {
  traceId: string;
  /** Name of the step, e.g. "prescription_read". */
  spanName: string;
  provider: string;
  model: string;
  latencySeconds: number;
  input?: unknown;
  output?: unknown;
  inputTokens?: number;
  outputTokens?: number;
  isError?: boolean;
  error?: string;
  distinctId?: string;
  properties?: Properties;
}

const DEFAULT_HOST = "https://us.i.posthog.com";

export class Telemetry {
  readonly enabled: boolean;
  readonly service: string;
  private readonly client?: PostHog;
  private readonly logs?: OtlpLogExporter;
  private readonly printToConsole: boolean;
  private readonly environment: string;

  constructor(options: TelemetryOptions) {
    this.service = options.service;
    this.environment = options.environment ?? process.env.NODE_ENV ?? "development";
    this.printToConsole = options.console ?? true;
    const token = options.token?.trim();
    this.enabled = Boolean(token);
    if (!token) return;
    const host = (options.host?.trim() || DEFAULT_HOST).replace(/\/$/, "");
    this.client = new PostHog(token, {
      host,
      flushAt: 20,
      flushInterval: 5000,
      // Uncaught exceptions and unhandled rejections become $exception events.
      enableExceptionAutocapture: true,
      fetch: options.fetch,
    });
    this.logs = new OtlpLogExporter({
      url: `${host}/i/v1/logs`,
      token,
      fetch: options.fetch,
      resource: {
        "service.name": options.service,
        "service.version": options.version,
        "deployment.environment": this.environment,
      },
    });
  }

  /** Distinct id for events that do not belong to a person (jobs, boot). */
  get systemId(): string {
    return `service:${this.service}`;
  }

  private baseProperties(distinctId: string): Properties {
    return {
      service: this.service,
      environment: this.environment,
      // System events must not create fake persons.
      ...(distinctId === this.systemId ? { $process_person_profile: false } : {}),
    };
  }

  capture(event: string, properties: Properties = {}, distinctId = this.systemId): void {
    this.client?.capture({ distinctId, event, properties: { ...this.baseProperties(distinctId), ...properties } });
  }

  captureException(error: unknown, properties: Properties = {}, distinctId = this.systemId): void {
    this.client?.captureException(error, distinctId, { ...this.baseProperties(distinctId), ...properties });
  }

  log(level: LogLevel, message: string, attributes: LogAttributes = {}): void {
    if (this.printToConsole) {
      const extra = Object.entries(attributes)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(" ");
      const line = extra ? `${message} ${extra}` : message;
      if (level === "error" || level === "fatal") console.error(line);
      else if (level === "warn") console.warn(line);
      else console.log(line);
    }
    this.logs?.emit(level, message, attributes);
  }

  info(message: string, attributes?: LogAttributes) {
    this.log("info", message, attributes);
  }

  warn(message: string, attributes?: LogAttributes) {
    this.log("warn", message, attributes);
  }

  error(message: string, attributes?: LogAttributes) {
    this.log("error", message, attributes);
  }

  llmGeneration(g: LlmGeneration): void {
    const distinctId = g.distinctId ?? this.systemId;
    this.capture(
      "$ai_generation",
      {
        $ai_trace_id: g.traceId,
        $ai_session_id: null,
        $ai_span_name: g.spanName,
        $ai_provider: g.provider,
        $ai_model: g.model,
        $ai_latency: g.latencySeconds,
        $ai_input: g.input,
        $ai_output_choices: g.output,
        $ai_input_tokens: g.inputTokens,
        $ai_output_tokens: g.outputTokens,
        $ai_is_error: g.isError ?? false,
        $ai_error: g.error,
        ...g.properties,
      },
      distinctId,
    );
  }

  async flush(): Promise<void> {
    await Promise.all([this.client?.flush(), this.logs?.flush()]);
  }

  /** Call on shutdown so buffered events and logs are not lost. */
  async shutdown(): Promise<void> {
    await this.logs?.flush();
    await this.client?.shutdown(5000);
  }
}

export function createTelemetry(options: TelemetryOptions): Telemetry {
  return new Telemetry(options);
}

/** Reads POSTHOG_PROJECT_TOKEN and POSTHOG_HOST from the environment. */
export function telemetryFromEnv(service: string, env: NodeJS.ProcessEnv = process.env): Telemetry {
  return new Telemetry({
    service,
    token: env.POSTHOG_PROJECT_TOKEN,
    host: env.POSTHOG_HOST,
    environment: env.NODE_ENV,
    version: env.SOURCE_COMMIT?.slice(0, 7),
  });
}

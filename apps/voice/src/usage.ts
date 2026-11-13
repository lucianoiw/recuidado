/**
 * What one GPT-Live session used, read from its sideband: billed voice seconds, when the phone
 * was answered and hung up (the phone line bills only that), and the tokens of each delegated
 * Responses request (counted once per response id, as the OpenAI cost guide says).
 */

export interface BackendUsage {
  model: string;
  responses: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
}

export interface SessionUsage {
  /** Billed voice seconds, from the last session.usage.updated or session.closed. */
  voiceSeconds?: number;
  /** Seconds between transport.answered and the end of the call (0 when never answered). */
  answeredSeconds: number;
  /** One entry per backend model. */
  backend: BackendUsage[];
}

interface SidebandLike {
  on(event: "message", listener: (data: unknown) => void): unknown;
  on(event: "close", listener: () => void): unknown;
}

export class UsageMeter {
  private voiceSeconds?: number;
  private answeredAt?: number;
  private endedAt?: number;
  private readonly seen = new Set<string>();
  private readonly backend = new Map<string, BackendUsage>();
  private resolveClosed!: () => void;
  /** Resolves on session.closed or when the sideband closes. */
  readonly closed = new Promise<void>((resolve) => (this.resolveClosed = resolve));

  constructor(private readonly now: () => number = Date.now) {}

  /** Listens to a sideband socket. Register before the call's own listener so the final usage is in first. */
  watch(socket: SidebandLike): this {
    socket.on("message", (data) => {
      try {
        this.handle(JSON.parse(String(data)) as Record<string, unknown>);
      } catch {
        // Not JSON: nothing to count.
      }
    });
    socket.on("close", () => this.end());
    return this;
  }

  handle(event: Record<string, unknown>) {
    switch (event.type) {
      case "transport.answered":
        this.answeredAt ??= this.now();
        break;
      case "session.usage.updated":
      case "session.closed": {
        const seconds = (event.usage as { seconds?: unknown } | undefined)?.seconds;
        // Each update replaces the previous one: never sum them.
        if (typeof seconds === "number") this.voiceSeconds = seconds;
        if (event.type === "session.closed") this.end();
        break;
      }
      case "response.event":
        this.backendEvent(event.event as Record<string, unknown> | undefined);
        break;
    }
  }

  private backendEvent(inner: Record<string, unknown> | undefined) {
    if (inner?.type !== "response.completed" && inner?.type !== "response.done") return;
    const response = inner.response as
      | {
          id?: string;
          model?: string;
          usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
        }
      | undefined;
    if (!response?.usage) return;
    if (response.id) {
      if (this.seen.has(response.id)) return;
      this.seen.add(response.id);
    }
    const model = response.model ?? "unknown";
    const entry = this.backend.get(model) ?? { model, responses: 0, inputTokens: 0, cachedTokens: 0, outputTokens: 0 };
    entry.responses += 1;
    entry.inputTokens += response.usage.input_tokens ?? 0;
    entry.cachedTokens += response.usage.input_tokens_details?.cached_tokens ?? 0;
    entry.outputTokens += response.usage.output_tokens ?? 0;
    this.backend.set(model, entry);
  }

  private end() {
    this.endedAt ??= this.now();
    this.resolveClosed();
  }

  /** Waits for the final usage (session.closed), at most `ms`. */
  async settle(ms = 8000): Promise<SessionUsage> {
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([this.closed, new Promise<void>((r) => (timer = setTimeout(r, ms)))]);
    if (timer) clearTimeout(timer);
    return this.summary();
  }

  summary(): SessionUsage {
    const end = this.endedAt ?? this.now();
    return {
      voiceSeconds: this.voiceSeconds,
      answeredSeconds: this.answeredAt ? Math.max(0, (end - this.answeredAt) / 1000) : 0,
      backend: [...this.backend.values()],
    };
  }
}

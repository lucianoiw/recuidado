import { DOSE_TOOL_NAME, buildGreeting, type ReminderContext } from "./prompt.js";

export type CallStatus = "dialing" | "ringing" | "answered" | "ended";
export type CallOutcome = "confirmed" | "not_taken" | "unclear" | "no_answer" | "failed";

export interface TranscriptLine {
  speaker: "assistant" | "patient";
  text: string;
}

export interface CallResult {
  sessionId: string;
  outcome: CallOutcome;
  /** True only when the patient said she took the medicine. */
  confirmed: boolean;
  note?: string;
  transcript: TranscriptLine[];
  error?: string;
  durationSeconds?: number;
  /** Why the call ended, e.g. "session_closed: <reason>", "max_duration", "hung_up_after_answer". */
  endReason?: string;
}

/** The parts of a WebSocket this class needs, so tests can use a fake. */
export interface SidebandSocket {
  send(data: string): void;
  close(): void;
  on(event: "open", listener: () => void): unknown;
  on(event: "message", listener: (data: unknown) => void): unknown;
  on(event: "close", listener: () => void): unknown;
  on(event: "error", listener: (err: Error) => void): unknown;
}

export interface ReminderCallOptions {
  sessionId: string;
  context: ReminderContext;
  socket: SidebandSocket;
  hangup: () => Promise<void>;
  maxCallMs: number;
  /** Time for the goodbye after the answer is recorded. */
  goodbyeMs?: number;
  /** Time to wait for session.closed after hanging up. */
  closeGraceMs?: number;
  log?: (msg: string, extra?: unknown) => void;
  /** Called when the call starts ringing or is answered. */
  onStatusChange?: (status: CallStatus) => void;
}

/** High-frequency events left out of the log. */
const QUIET_EVENTS = new Set(["session.usage.updated", "response.event", "session.input_audio.append"]);

type LiveEvent = { type: string; event_id?: string; [key: string]: unknown };

/**
 * Follows one outbound reminder call over the sideband WebSocket and resolves
 * with the outcome once the session closes.
 */
export class ReminderCall {
  status: CallStatus = "dialing";
  private readonly seen = new Set<string>();
  private readonly transcript: TranscriptLine[] = [];
  private answer?: { taken: boolean; note?: string };
  private answered = false;
  private error?: string;
  private durationSeconds?: number;
  private hangupRequested = false;
  private endReason?: string;
  private finished = false;
  private timers: NodeJS.Timeout[] = [];
  private resolveResult!: (r: CallResult) => void;
  readonly result: Promise<CallResult>;

  constructor(private readonly opts: ReminderCallOptions) {
    this.result = new Promise((resolve) => (this.resolveResult = resolve));
    const { socket } = opts;
    socket.on("message", (data) => this.onMessage(data));
    socket.on("close", () => {
      this.endReason ??= "sideband_closed";
      this.finish();
    });
    socket.on("error", (err) => {
      this.error ??= `sideband error: ${err.message}`;
      this.log("sideband error", err.message);
    });
    this.timers.push(
      setTimeout(() => {
        this.log("max call duration reached");
        this.endReason ??= "max_duration";
        void this.endCall();
      }, opts.maxCallMs),
    );
  }

  private log(msg: string, extra?: unknown) {
    this.opts.log?.(`${new Date().toISOString()} [${this.opts.sessionId}] ${msg}`, extra);
  }

  private send(event: Record<string, unknown>) {
    this.opts.socket.send(JSON.stringify(event));
  }

  private onMessage(data: unknown) {
    let event: LiveEvent;
    try {
      event = JSON.parse(String(data)) as LiveEvent;
    } catch {
      return;
    }
    // The sideband replays the last 3 seconds on attach; replayed events keep their ids.
    if (event.event_id) {
      if (this.seen.has(event.event_id)) return;
      this.seen.add(event.event_id);
    }
    this.handle(event);
  }

  handle(event: LiveEvent) {
    if (!QUIET_EVENTS.has(String(event.type)) && !String(event.type).endsWith(".delta")) {
      this.log(`event ${String(event.type)}`);
    }
    switch (event.type) {
      case "transport.ringing":
        if (this.status === "dialing") {
          this.status = "ringing";
          this.opts.onStatusChange?.("ringing");
        }
        break;
      case "transport.answered":
        this.status = "answered";
        this.answered = true;
        this.opts.onStatusChange?.("answered");
        this.send({
          type: "session.commentary.append",
          event_id: `greeting_${this.opts.sessionId}`,
          delegation_id: null,
          content: buildGreeting(this.opts.context),
        });
        break;
      case "transport.failed": {
        const err = event.error as { code?: string; message?: string } | undefined;
        this.error = `transport failed: ${err?.code ?? "unknown"} ${err?.message ?? ""}`.trim();
        this.log(this.error);
        void this.endCall();
        break;
      }
      case "session.input_transcript.delta":
        this.appendTranscript("patient", String(event.delta ?? ""));
        break;
      case "session.output_transcript.delta":
        this.appendTranscript("assistant", String(event.delta ?? ""));
        break;
      case "response.event":
        this.handleResponseEvent(event.event as LiveEvent | undefined);
        break;
      case "session.usage.updated": {
        const usage = event.usage as { seconds?: number } | undefined;
        if (typeof usage?.seconds === "number") this.durationSeconds = usage.seconds;
        break;
      }
      case "session.closed": {
        const usage = event.usage as { seconds?: number } | undefined;
        if (typeof usage?.seconds === "number") this.durationSeconds = usage.seconds;
        this.log(`session closed: ${JSON.stringify({ ...event, usage: undefined })}`);
        this.endReason ??= `session_closed: ${String(event.reason ?? "unknown")}`;
        this.finish();
        break;
      }
      case "error":
        this.log("live error", event.error);
        break;
    }
  }

  private handleResponseEvent(inner: LiveEvent | undefined) {
    if (inner?.type !== "response.output_item.done") return;
    const item = inner.item as
      | { type?: string; name?: string; call_id?: string; arguments?: string }
      | undefined;
    if (item?.type !== "function_call" || item.name !== DOSE_TOOL_NAME || !item.call_id) return;

    let args: { taken?: unknown; note?: unknown } = {};
    try {
      args = JSON.parse(item.arguments ?? "{}");
    } catch {
      // Keep defaults; an unparseable answer counts as unclear.
    }
    const taken = args.taken === true ? true : args.taken === false ? false : undefined;
    const note = typeof args.note === "string" && args.note.trim() ? args.note.trim() : undefined;
    if (taken !== undefined) this.answer = { taken, note };
    this.log(`dose answer recorded: taken=${String(taken)}`);

    this.send({
      type: "response.item.create",
      event_id: `result_${item.call_id}`,
      item: {
        type: "function_call_output",
        call_id: item.call_id,
        output: JSON.stringify({ recorded: taken !== undefined }),
      },
    });
    this.send({ type: "response.create", event_id: `continue_${item.call_id}` });

    this.timers.push(
      setTimeout(() => {
        this.endReason ??= "hung_up_after_answer";
        void this.endCall();
      }, this.opts.goodbyeMs ?? 9000),
    );
  }

  private appendTranscript(speaker: TranscriptLine["speaker"], delta: string) {
    if (!delta) return;
    const last = this.transcript.at(-1);
    if (last && last.speaker === speaker) last.text += delta;
    else this.transcript.push({ speaker, text: delta });
  }

  /** Hangs up and waits briefly for session.closed so usage is final. */
  async endCall() {
    if (this.hangupRequested || this.finished) return;
    this.hangupRequested = true;
    try {
      await this.opts.hangup();
    } catch (err) {
      this.log("hangup failed", (err as Error).message);
    }
    this.timers.push(setTimeout(() => this.finish(), this.opts.closeGraceMs ?? 5000));
  }

  private outcome(): CallOutcome {
    if (this.answer) return this.answer.taken ? "confirmed" : "not_taken";
    if (this.answered) return "unclear";
    return this.error ? "failed" : "no_answer";
  }

  private finish() {
    if (this.finished) return;
    this.finished = true;
    this.status = "ended";
    for (const t of this.timers) clearTimeout(t);
    try {
      this.opts.socket.close();
    } catch {
      // Already closed.
    }
    const outcome = this.outcome();
    this.resolveResult({
      sessionId: this.opts.sessionId,
      outcome,
      confirmed: outcome === "confirmed",
      note: this.answer?.note,
      // Drop sound tags such as "[mouth noise]" from the stored transcript.
      transcript: this.transcript
        .map((l) => ({ ...l, text: l.text.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim() }))
        .filter((l) => l.text),
      error: this.error,
      durationSeconds: this.durationSeconds,
      endReason: this.endReason ?? (this.error ? "error" : undefined),
    });
  }
}

import type { SidebandSocket } from "./reminder-call.js";

/** Builds the message read to a family member when the patient reports an emergency (local test path). */
export function buildEmergencyMessage(patientName: string, note?: string): string {
  const said = note?.trim() ? `: "${note.trim()}"` : " que não está bem";
  return `Olá, aqui é a assistente virtual da Recuidado. Liguei para ${patientName} para saber sobre o medicamento, e ela disse${said}. Por favor, entre em contato com ela agora. Se for grave, ligue para o SAMU, 192.`;
}

/** The message ends with the SAMU line: once it is heard, the message was delivered. */
const MESSAGE_END = /samu|192|noventa e dois/i;

/** Instructions for the one-way alert call: say the message, repeat once if asked, never advise. */
export function buildAlertInstructions(message: string): string {
  return [
    "You are the virtual assistant of Recuidado calling a family member with an urgent message about an older relative.",
    "Speak only Brazilian Portuguese, calm and clear.",
    `As soon as the call is answered, say exactly: "${message}"`,
    "If they ask you to repeat or ask what happened, repeat the message once. You know nothing beyond it.",
    "Never give medical advice and never discuss other topics. If an automated call-screening assistant asks who is calling, say: \"Recuidado, recado urgente da família.\"",
    "After the message, say nothing else.",
  ].join("\n");
}

export interface AlertCallResult {
  sessionId: string;
  answered: boolean;
  /** True when the assistant reached the end of the message (the SAMU line). */
  delivered: boolean;
  endReason?: string;
  error?: string;
}

export interface AlertCallOptions {
  sessionId: string;
  message: string;
  socket: SidebandSocket;
  hangup: () => Promise<void>;
  maxCallMs: number;
  /** Silence after the message before hanging up. */
  tailMs?: number;
  closeGraceMs?: number;
  log?: (msg: string) => void;
}

type LiveEvent = { type: string; event_id?: string; [key: string]: unknown };

/** Follows one alert call: speaks the message on answer and hangs up shortly after it ends. */
export class AlertCall {
  private readonly seen = new Set<string>();
  private answered = false;
  private delivered = false;
  private spoken = "";
  private endReason?: string;
  private error?: string;
  private hangupRequested = false;
  private finished = false;
  private tailTimer?: NodeJS.Timeout;
  private timers: NodeJS.Timeout[] = [];
  private resolveResult!: (r: AlertCallResult) => void;
  readonly result: Promise<AlertCallResult>;

  constructor(private readonly opts: AlertCallOptions) {
    this.result = new Promise((resolve) => (this.resolveResult = resolve));
    opts.socket.on("message", (data) => {
      let event: LiveEvent;
      try {
        event = JSON.parse(String(data)) as LiveEvent;
      } catch {
        return;
      }
      if (event.event_id) {
        if (this.seen.has(event.event_id)) return;
        this.seen.add(event.event_id);
      }
      this.handle(event);
    });
    opts.socket.on("close", () => {
      this.endReason ??= "sideband_closed";
      this.finish();
    });
    opts.socket.on("error", (err) => {
      this.error ??= `sideband error: ${err.message}`;
    });
    this.timers.push(
      setTimeout(() => {
        this.endReason ??= "max_duration";
        void this.endCall();
      }, opts.maxCallMs),
    );
  }

  private log(msg: string) {
    this.opts.log?.(`${new Date().toISOString()} [${this.opts.sessionId}] ${msg}`);
  }

  handle(event: LiveEvent) {
    switch (event.type) {
      case "transport.answered":
        this.answered = true;
        this.log("alert call answered");
        this.opts.socket.send(
          JSON.stringify({
            type: "session.commentary.append",
            event_id: `alert_${this.opts.sessionId}`,
            delegation_id: null,
            content: `Say now, exactly: "${this.opts.message}"`,
          }),
        );
        break;
      case "transport.failed": {
        const err = event.error as { code?: string; message?: string } | undefined;
        this.error = `transport failed: ${err?.code ?? "unknown"} ${err?.message ?? ""}`.trim();
        this.log(this.error);
        void this.endCall();
        break;
      }
      case "session.output_transcript.delta":
        this.spoken += String(event.delta ?? "");
        if (MESSAGE_END.test(this.spoken)) {
          if (!this.delivered) this.log("alert message delivered");
          this.delivered = true;
          // Restart on every fragment: hang up once the assistant stops talking.
          if (this.tailTimer) clearTimeout(this.tailTimer);
          this.tailTimer = setTimeout(() => {
            this.endReason ??= "message_delivered";
            void this.endCall();
          }, this.opts.tailMs ?? 2500);
          this.timers.push(this.tailTimer);
        }
        break;
      case "session.closed":
        this.endReason ??= `session_closed: ${String(event.reason ?? "unknown")}`;
        this.finish();
        break;
    }
  }

  async endCall() {
    if (this.hangupRequested || this.finished) return;
    this.hangupRequested = true;
    try {
      await this.opts.hangup();
    } catch (err) {
      this.log(`hangup failed: ${(err as Error).message}`);
    }
    this.timers.push(setTimeout(() => this.finish(), this.opts.closeGraceMs ?? 5000));
  }

  private finish() {
    if (this.finished) return;
    this.finished = true;
    for (const t of this.timers) clearTimeout(t);
    try {
      this.opts.socket.close();
    } catch {
      // Already closed.
    }
    this.resolveResult({
      sessionId: this.opts.sessionId,
      answered: this.answered,
      delivered: this.delivered,
      endReason: this.endReason,
      error: this.error,
    });
  }
}

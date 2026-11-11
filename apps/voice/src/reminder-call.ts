import { DOSE_TOOL_NAME, buildGreeting, goodbyeLine, greetingLine, type ReminderContext } from "./prompt.js";
import { normalizeSpeech } from "./greeting-cache.js";

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
  /** True when she said she is not feeling well. */
  feelsUnwell?: boolean;
  /** True for a possible emergency (fall, chest pain, shortness of breath, fainting): the family gets a call. */
  emergency?: boolean;
  transcript: TranscriptLine[];
  error?: string;
  durationSeconds?: number;
  /** Why the call ended, e.g. "hung_up_after_goodbye", "hung_up_after_answer" (no goodbye heard), "session_closed: <reason>", "max_duration". */
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
  /** After the answer is recorded, hang up when the assistant has said nothing for this long and no goodbye came. */
  goodbyeMs?: number;
  /** After the goodbye, how long to wait for her to answer before hanging up. */
  goodbyeTailMs?: number;
  /** After the goodbye, hang up this long after she stops answering. */
  replyTailMs?: number;
  /** Longest time the patient's microphone stays muted while the greeting plays. */
  greetingMuteMs?: number;
  /** Longest wait for the answer to be recorded after the goodbye was said. */
  recordAfterGoodbyeMs?: number;
  /** Raw PCM16 24 kHz greeting recorded on an earlier call; played as soon as the call is answered. */
  greetingAudio?: Buffer;
  /** Called with the greeting audio when the model said the expected greeting line, to reuse it. */
  onGreetingRecorded?: (line: string, audio: Buffer) => void;
  /** Fixed clock for the greeting line in tests. */
  now?: Date;
  /** Time to wait for session.closed after hanging up. */
  closeGraceMs?: number;
  log?: (msg: string, extra?: unknown) => void;
  /** Called when the call starts ringing or is answered. */
  onStatusChange?: (status: CallStatus) => void;
}

/** Phrases from carrier voicemail greetings. Talking to a recording helps nobody, so the call ends. */
const VOICEMAIL = /grave (a )?sua mensagem|deixe (a )?sua mensagem|ap[óo]s o sinal|caixa postal|caixa de mensagens/i;

/** The goodbye the assistant is told to say at the end. */
const GOODBYE = /tchau/i;

/** High-frequency events left out of the log. */
const QUIET_EVENTS = new Set([
  "session.usage.updated",
  "response.event",
  "session.input_audio.append",
  "session.output_audio.delta",
]);

type LiveEvent = { type: string; event_id?: string; [key: string]: unknown };

/**
 * Follows one outbound reminder call over the sideband WebSocket and resolves
 * with the outcome once the session closes.
 */
export class ReminderCall {
  status: CallStatus = "dialing";
  private readonly seen = new Set<string>();
  private readonly transcript: TranscriptLine[] = [];
  private answer?: { taken: boolean; feelsUnwell?: boolean; emergency?: boolean; note?: string };
  private answered = false;
  private error?: string;
  private durationSeconds?: number;
  private hangupRequested = false;
  private endReason?: string;
  private voicemail = false;
  private greetingMuted = false;
  private greetingText = "";
  private goodbyeTimer?: NodeJS.Timeout;
  private silenceTimer?: NodeJS.Timeout;
  private recordTimer?: NodeJS.Timeout;
  private goodbyeHeard = false;
  private assistantSinceGreeting = "";
  private greetingDone = false;
  private readonly greetingLine: string;
  /** Output audio of the greeting while the model speaks it, to record it for later calls. */
  private greetingAudio: { startMs: number; audio: Buffer }[] = [];
  private greetingEndMs?: number;
  private greetingCaptured = false;
  private firstAssistantLogged = false;
  private finished = false;
  private timers: NodeJS.Timeout[] = [];
  private resolveResult!: (r: CallResult) => void;
  readonly result: Promise<CallResult>;

  constructor(private readonly opts: ReminderCallOptions) {
    this.result = new Promise((resolve) => (this.resolveResult = resolve));
    this.greetingLine = greetingLine(opts.context, opts.now);
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
        if (this.opts.greetingAudio) {
          // Recorded greeting: plays at once, and the server mutes her input while it plays.
          this.log("playing recorded greeting");
          this.send({
            type: "session.output_audio.fixture.play",
            event_id: `fixture_${this.opts.sessionId}`,
            audio: this.opts.greetingAudio.toString("base64"),
          });
        } else {
          this.speakGreeting();
        }
        break;
      case "session.output_audio.fixture.played":
        this.greetingDone = true;
        this.send({
          type: "session.instructions.append",
          event_id: `greeted_${this.opts.sessionId}`,
          delegation_id: null,
          content: `You just greeted her out loud with: "${this.greetingLine}". Do not repeat it. Listen to her answer.`,
        });
        break;
      case "session.output_audio.delta":
        this.captureGreetingAudio(event);
        break;
      case "transport.failed": {
        const err = event.error as { code?: string; message?: string } | undefined;
        this.error = `transport failed: ${err?.code ?? "unknown"} ${err?.message ?? ""}`.trim();
        this.log(this.error);
        void this.endCall();
        break;
      }
      case "session.input_transcript.delta":
        if (event.delta) {
          if (!this.greetingDone) {
            // She spoke before the greeting question was heard: the greeting phase is over, and its audio is not clean.
            this.greetingDone = true;
            this.greetingCaptured = true;
          }
          this.finishGreetingCapture();
        }
        this.appendTranscript("patient", String(event.delta ?? ""));
        this.checkVoicemail();
        // She answered the goodbye: hang up shortly after she stops talking.
        if (this.goodbyeTimer && event.delta) this.armGoodbyeHangup(this.opts.replyTailMs ?? 1000);
        break;
      case "session.output_transcript.delta":
        this.onAssistantSpeech(String(event.delta ?? ""), event);
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
      case "error": {
        this.log("live error", event.error);
        const failed = (event.error as { client_event_id?: string } | undefined)?.client_event_id;
        // The recording was refused: greet the usual way.
        if (failed?.startsWith("fixture_") && !this.greetingDone) this.speakGreeting();
        break;
      }
    }
  }

  private handleResponseEvent(inner: LiveEvent | undefined) {
    if (inner?.type !== "response.output_item.done") return;
    const item = inner.item as
      | { type?: string; name?: string; call_id?: string; arguments?: string }
      | undefined;
    if (item?.type !== "function_call" || item.name !== DOSE_TOOL_NAME || !item.call_id) return;

    let args: { taken?: unknown; feels_unwell?: unknown; emergency?: unknown; note?: unknown } = {};
    try {
      args = JSON.parse(item.arguments ?? "{}");
    } catch {
      // Keep defaults; an unparseable answer counts as unclear.
    }
    const taken = args.taken === true ? true : args.taken === false ? false : undefined;
    const note = typeof args.note === "string" && args.note.trim() ? args.note.trim() : undefined;
    const feelsUnwell = typeof args.feels_unwell === "boolean" ? args.feels_unwell : undefined;
    const emergency = args.emergency === true;
    if (taken !== undefined) this.answer = { taken, feelsUnwell: emergency ? true : feelsUnwell, emergency, note };
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

    if (this.recordTimer) clearTimeout(this.recordTimer);
    if (this.goodbyeHeard) {
      // The goodbye was said while the answer was being recorded: give it a moment to finish, then hang up.
      this.armGoodbyeHangup((this.opts.replyTailMs ?? 1000) * 2);
      return;
    }
    // No goodbye yet: ask for it once, and hang up after a few seconds of silence anyway.
    this.send({
      type: "session.commentary.append",
      event_id: `goodbye_${item.call_id}`,
      delegation_id: null,
      content: `Say now, exactly: "${goodbyeLine(this.opts.context)}"`,
    });
    this.armSilenceHangup();
  }

  private armSilenceHangup() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      this.endReason ??= "hung_up_after_answer";
      this.log("no goodbye heard, hanging up");
      void this.endCall();
    }, this.opts.goodbyeMs ?? 8000);
    this.timers.push(this.silenceTimer);
  }

  private onAssistantSpeech(delta: string, event: LiveEvent) {
    if (!delta) return;
    if (!this.firstAssistantLogged) {
      this.firstAssistantLogged = true;
      this.log(`assistant started speaking (session ms ${String(event.start_ms ?? "?")})`);
    }
    this.appendTranscript("assistant", delta);
    if (!this.greetingDone) {
      this.greetingText += delta;
      // The greeting ends with the question; leave a moment for its audio to finish.
      if (this.greetingText.includes("?")) {
        this.greetingDone = true;
        if (typeof event.end_ms === "number") this.greetingEndMs = event.end_ms;
        this.timers.push(setTimeout(() => this.finishGreetingCapture(), 2500));
        if (this.greetingMuted) this.timers.push(setTimeout(() => this.unmuteAfterGreeting("question asked"), 800));
      }
      return;
    }
    this.assistantSinceGreeting += delta;
    if (GOODBYE.test(this.assistantSinceGreeting)) {
      if (!this.goodbyeHeard) {
        this.goodbyeHeard = true;
        this.log("goodbye heard");
      }
      if (this.answer) {
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        // Give her a moment to say goodbye back; minutes are paid, so do not wait long.
        this.armGoodbyeHangup(this.opts.goodbyeTailMs ?? 3000);
      } else if (!this.recordTimer) {
        this.recordTimer = setTimeout(() => {
          this.endReason ??= "hung_up_before_answer_recorded";
          this.log("answer not recorded after the goodbye, hanging up");
          void this.endCall();
        }, this.opts.recordAfterGoodbyeMs ?? 12_000);
        this.timers.push(this.recordTimer);
      }
      return;
    }
    // Still talking after the answer (for example telling her the family will be told): restart the silence wait.
    if (this.answer) this.armSilenceHangup();
  }

  private speakGreeting() {
    // Mute her microphone while the greeting plays, so an "alô" does not make the model wait or restart.
    this.greetingMuted = true;
    this.send({ type: "session.input_audio.mute", event_id: `mute_${this.opts.sessionId}` });
    this.send({
      type: "session.commentary.append",
      event_id: `greeting_${this.opts.sessionId}`,
      delegation_id: null,
      content: buildGreeting(this.opts.context, this.opts.now),
    });
    this.timers.push(setTimeout(() => this.unmuteAfterGreeting("timeout"), this.opts.greetingMuteMs ?? 6000));
  }

  /** Keeps the model's greeting audio so later calls can play it the moment she answers. */
  private captureGreetingAudio(event: LiveEvent) {
    if (this.opts.greetingAudio || this.greetingCaptured || !this.answered || !this.opts.onGreetingRecorded) return;
    const startMs = typeof event.start_ms === "number" ? event.start_ms : undefined;
    if (startMs === undefined || typeof event.delta !== "string") return;
    if (this.greetingEndMs !== undefined && startMs > this.greetingEndMs + 400) {
      this.finishGreetingCapture();
      return;
    }
    this.greetingAudio.push({ startMs, audio: Buffer.from(event.delta, "base64") });
  }

  private finishGreetingCapture() {
    if (this.greetingCaptured || this.opts.greetingAudio || !this.opts.onGreetingRecorded) return;
    if (!this.greetingDone) return;
    this.greetingCaptured = true;
    const said = this.greetingText.slice(0, this.greetingText.indexOf("?") + 1);
    if (normalizeSpeech(said) !== normalizeSpeech(this.greetingLine)) {
      this.log("greeting differed from the expected line, not recorded");
      return;
    }
    const end = this.greetingEndMs ?? Number.POSITIVE_INFINITY;
    const audio = Buffer.concat(
      this.greetingAudio
        .filter((c) => c.startMs <= end + 400)
        .sort((a, b) => a.startMs - b.startMs)
        .map((c) => c.audio),
    );
    this.greetingAudio = [];
    if (audio.length === 0) return;
    this.opts.onGreetingRecorded(this.greetingLine, audio);
  }

  private armGoodbyeHangup(ms: number) {
    if (this.goodbyeTimer) clearTimeout(this.goodbyeTimer);
    this.goodbyeTimer = setTimeout(() => {
      this.endReason ??= "hung_up_after_goodbye";
      void this.endCall();
    }, ms);
    this.timers.push(this.goodbyeTimer);
  }

  private unmuteAfterGreeting(why: string) {
    if (!this.greetingMuted) return;
    this.greetingMuted = false;
    this.log(`unmuting patient (${why})`);
    this.send({ type: "session.input_audio.unmute", event_id: `unmute_${this.opts.sessionId}` });
  }

  private checkVoicemail() {
    if (this.voicemail || this.answer || this.hangupRequested) return;
    const heard = this.transcript
      .filter((l) => l.speaker === "patient")
      .map((l) => l.text)
      .join(" ");
    if (!VOICEMAIL.test(heard)) return;
    this.voicemail = true;
    this.endReason ??= "voicemail";
    this.log("voicemail detected, hanging up");
    void this.endCall();
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
    if (this.voicemail) return "no_answer";
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
      feelsUnwell: this.answer?.feelsUnwell,
      emergency: this.answer?.emergency || undefined,
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

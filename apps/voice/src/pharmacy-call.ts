import {
  KEYPAD_TOOL_NAME,
  PHARMACY_TOOL_NAME,
  pharmacyOpening,
  type PharmacyContext,
} from "./pharmacy-prompt.js";
import type { CallStatus, SidebandSocket, TranscriptLine } from "./reminder-call.js";

export type PharmacyCallOutcome = "answered" | "unclear" | "no_answer" | "failed";
export type TriState = "yes" | "no" | "unknown";

export interface PharmacyItem {
  medication: string;
  available: TriState;
  /** Price of one box in cents, as the attendant said it. Reference only, not an offer. */
  priceCents: number | null;
  package?: string;
  farmaciaPopular: TriState;
}

export interface PharmacyCallResult {
  sessionId: string;
  outcome: PharmacyCallOutcome;
  items: PharmacyItem[];
  note?: string;
  /** Keys pressed in a recorded menu (URA), in order. */
  keysPressed: string[];
  /** "speaker" is "patient" for the other side, to share the TranscriptLine shape. */
  transcript: TranscriptLine[];
  error?: string;
  durationSeconds?: number;
  endReason?: string;
}

export interface PharmacyCallOptions {
  sessionId: string;
  context: PharmacyContext;
  socket: SidebandSocket;
  hangup: () => Promise<void>;
  maxCallMs: number;
  /** If nobody speaks this long after the call is answered, the assistant opens. */
  openingWaitMs?: number;
  /** After a person speaks, wait this long for the assistant to introduce itself before asking it to. */
  introduceAfterMs?: number;
  /** Silence after a menu before the service picks the key. */
  menuPauseMs?: number;
  /** Pause between two DTMF keys. */
  keyGapMs?: number;
  /** After the answer is recorded, hang up after this much silence without a goodbye. */
  goodbyeMs?: number;
  /** After the goodbye, how long to wait before hanging up. */
  goodbyeTailMs?: number;
  closeGraceMs?: number;
  log?: (msg: string, extra?: unknown) => void;
  onStatusChange?: (status: CallStatus) => void;
}

const VOICEMAIL = /grave (a )?sua mensagem|deixe (a )?sua mensagem|ap[óo]s o sinal|caixa postal|caixa de mensagens/i;
const GOODBYE = /tchau/i;
const QUIET_EVENTS = new Set(["session.usage.updated", "response.event", "session.input_audio.append"]);
const KEYS = /^[0-9*#]{1,8}$/;
/** A recorded menu asking for a key. */
const MENU = /\b(tecle|digite|pressione|disque)\b/i;
/** Menu options worth choosing, best first: prices and stock, then a person, then medicines. */
const WANTED = [/pre[çc]o|estoque/i, /atendente|atendimento|balc[ãa]o|falar com/i, /rem[ée]dio|medicamento/i];
const OPTION = /([^.]*?)(?:tecle|digite|pressione|disque)\s*(\d|zero|um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove)\b/gi;

/** The key for the best option of a recorded menu, or null when none fits. */
export function menuChoice(menu: string): string | null {
  const options = [...menu.matchAll(OPTION)].map((m) => ({
    label: m[1],
    key: /^\d$/.test(m[2]) ? m[2] : (DIGIT_WORDS[m[2].toLowerCase()] ?? null),
  }));
  for (const wanted of WANTED) {
    const hit = options.find((o) => o.key && wanted.test(o.label));
    if (hit) return hit.key;
  }
  return null;
}

const DIGIT_WORDS: Record<string, string> = {
  zero: "0", um: "1", dois: "2", "três": "3", tres: "3", quatro: "4", cinco: "5", seis: "6", sete: "7", oito: "8", nove: "9",
};
/** The assistant saying the option aloud, e.g. "Opção 2" or "vou teclar dois". */
const SPOKEN_CHOICE = /(?:op[çc][ãa]o|tecla|teclar|teclo|n[úu]mero)\s*(\d|zero|um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove)\b/i;

/** The digit the assistant said it chose, or null. */
export function spokenChoice(text: string): string | null {
  const m = text.match(SPOKEN_CHOICE);
  if (!m) return null;
  const word = m[1].toLowerCase();
  return /^\d$/.test(word) ? word : (DIGIT_WORDS[word] ?? null);
}

type LiveEvent = { type: string; event_id?: string; [key: string]: unknown };

function triState(v: unknown): TriState {
  return v === "yes" || v === "no" ? v : "unknown";
}

/** "18,90" or 18.9 → 1890. Anything else → null. */
export function toCents(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 100_000) return null;
  return Math.round(n * 100);
}

/**
 * Follows one call to a pharmacy over the sideband WebSocket: presses keys in a
 * recorded menu when the model asks, records stock and price, and hangs up after the goodbye.
 */
export class PharmacyCall {
  status: CallStatus = "dialing";
  private readonly seen = new Set<string>();
  private readonly transcript: TranscriptLine[] = [];
  private readonly keysPressed: string[] = [];
  private answer?: { items: PharmacyItem[]; note?: string };
  private answered = false;
  private heardOtherSide = false;
  /** A menu was heard and no key was pressed since. */
  private menuPending = false;
  private assistantSinceMenu = "";
  /** The opening ("assistente virtual da Recuidado") was said or requested. */
  private introduced = false;
  private menuTimer?: NodeJS.Timeout;
  /** When the last key was sent, to drop a late duplicate from the model. */
  private lastKeyAt = 0;
  /** Transcript length when the last key was pressed. */
  private transcriptAtKey = 0;
  private error?: string;
  private durationSeconds?: number;
  private hangupRequested = false;
  private endReason?: string;
  private voicemail = false;
  private assistantAfterAnswer = "";
  private silenceTimer?: NodeJS.Timeout;
  private goodbyeTimer?: NodeJS.Timeout;
  private introTimer?: NodeJS.Timeout;
  private finished = false;
  private timers: NodeJS.Timeout[] = [];
  private resolveResult!: (r: PharmacyCallResult) => void;
  readonly result: Promise<PharmacyCallResult>;

  constructor(private readonly opts: PharmacyCallOptions) {
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
    if (event.event_id) {
      if (this.seen.has(event.event_id)) return;
      this.seen.add(event.event_id);
    }
    this.handle(event);
  }

  handle(event: LiveEvent) {
    if (!QUIET_EVENTS.has(String(event.type)) && !String(event.type).endsWith(".delta")) {
      this.log(`event ${event.type}`);
    }
    switch (event.type) {
      case "transport.ringing":
        this.status = "ringing";
        this.opts.onStatusChange?.("ringing");
        break;
      case "transport.answered":
        this.status = "answered";
        this.answered = true;
        this.opts.onStatusChange?.("answered");
        // Pharmacies and menus usually speak first. If nobody does, open the conversation.
        this.timers.push(setTimeout(() => this.openIfSilent(), this.opts.openingWaitMs ?? 4000));
        break;
      case "transport.failed": {
        const err = event.error as { code?: string; message?: string } | undefined;
        this.error = `transport failed: ${err?.code ?? "unknown"} ${err?.message ?? ""}`.trim();
        this.log(this.error);
        void this.endCall();
        break;
      }
      case "transport.dtmf.sent":
        this.log(`dtmf sent: ${String(event.event ?? "?")}`);
        break;
      case "session.input_transcript.delta":
        if (event.delta) this.heardOtherSide = true;
        this.appendTranscript("patient", String(event.delta ?? ""));
        if (MENU.test(this.otherSideSinceKey()) && !this.answer) {
          if (!this.menuPending) this.assistantSinceMenu = "";
          this.menuPending = true;
          // Choose the key ourselves once the menu stops talking for a moment.
          if (this.menuTimer) clearTimeout(this.menuTimer);
          this.menuTimer = setTimeout(() => this.chooseFromMenu(), this.opts.menuPauseMs ?? 1500);
          this.timers.push(this.menuTimer);
        } else if (event.delta && !this.menuPending) {
          // A person (not a menu) is talking: the assistant must say who it is before anything else.
          // Wait until they pause, so the start of a recorded menu is not taken for a person.
          if (this.introTimer) clearTimeout(this.introTimer);
          this.introTimer = setTimeout(() => this.introduceIfNeeded(), this.opts.introduceAfterMs ?? 2500);
          this.timers.push(this.introTimer);
        }
        this.checkVoicemail();
        if (this.goodbyeTimer && event.delta) this.armGoodbyeHangup(1000);
        break;
      case "session.output_transcript.delta":
        this.onAssistantSpeech(String(event.delta ?? ""));
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

  private chooseFromMenu() {
    if (!this.menuPending || this.answer || this.hangupRequested || this.finished) return;
    const key = menuChoice(this.otherSideSinceKey());
    if (!key) {
      this.log("no menu option fits, leaving it to the model");
      return;
    }
    this.log(`menu option chosen by rule: ${key}`);
    this.sendKeys(`menu_${this.keysPressed.length}`, [key]);
  }

  private introduceIfNeeded() {
    if (this.introduced || this.answer || this.hangupRequested || this.finished || this.menuPending) return;
    // Menus arrive in small pieces mixed with the assistant's words: look at everything heard since the last key.
    if (MENU.test(this.otherSideSinceKey())) return;
    this.introduced = true;
    this.log("person on the line and no introduction yet, introducing");
    this.send({
      type: "session.commentary.append",
      event_id: `introduce_${this.opts.sessionId}`,
      delegation_id: null,
      content: `Say exactly this in Brazilian Portuguese now, before anything else, then listen: "${pharmacyOpening(this.opts.context)}"`,
    });
  }

  /** What the other side said since the last key press (or since the start). */
  private otherSideSinceKey(): string {
    return this.transcript
      .slice(this.transcriptAtKey)
      .filter((l) => l.speaker === "patient")
      .map((l) => l.text)
      .join(" ");
  }

  private openIfSilent() {
    if (this.heardOtherSide || this.answer || this.hangupRequested) return;
    this.introduced = true;
    this.log("nobody spoke after answer, opening");
    this.send({
      type: "session.commentary.append",
      event_id: `opening_${this.opts.sessionId}`,
      delegation_id: null,
      content: `Say exactly this in Brazilian Portuguese, then stop and listen: "${pharmacyOpening(this.opts.context)}"`,
    });
  }

  private handleResponseEvent(inner: LiveEvent | undefined) {
    if (inner?.type !== "response.output_item.done") return;
    const item = inner.item as { type?: string; name?: string; call_id?: string; arguments?: string } | undefined;
    if (item?.type !== "function_call" || !item.call_id) return;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(item.arguments ?? "{}");
    } catch {
      // Handled as an invalid call below.
    }
    if (item.name === KEYPAD_TOOL_NAME) return this.pressKeys(item.call_id, args.keys);
    if (item.name === PHARMACY_TOOL_NAME) return this.recordAnswer(item.call_id, args);
  }

  private pressKeys(callId: string, keys: unknown) {
    const valid = typeof keys === "string" && KEYS.test(keys.trim());
    if (valid && Date.now() - this.lastKeyAt < 6000) {
      // The service already chose this menu by rule; a second key would answer the next menu.
      this.log(`model key ${String(keys)} ignored, a key was just sent`);
    } else if (valid) {
      this.sendKeys(callId, [...(keys as string).trim()]);
    } else {
      this.log("invalid keypad request", keys);
    }
    this.toolOutput(callId, { pressed: valid ? (keys as string).trim() : "", ok: valid });
  }

  private sendKeys(id: string, digits: string[]) {
    this.menuPending = false;
    this.lastKeyAt = Date.now();
    if (this.menuTimer) clearTimeout(this.menuTimer);
    this.transcriptAtKey = this.transcript.length;
    this.assistantSinceMenu = "";
    const gap = this.opts.keyGapMs ?? 300;
    digits.forEach((key, i) => {
      const send = () => {
        if (this.finished) return;
        this.send({ type: "transport.dtmf.send", event: key, event_id: `dtmf_${id}_${i}` });
      };
      if (i === 0) send();
      else this.timers.push(setTimeout(send, gap * i));
    });
    this.keysPressed.push(...digits);
    this.log(`pressing keys ${digits.join("")}`);
  }

  private recordAnswer(callId: string, args: Record<string, unknown>) {
    const rawItems = Array.isArray(args.items) ? args.items : [];
    const items: PharmacyItem[] = rawItems
      .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
      .map((i) => ({
        medication: String(i.medication ?? "").trim(),
        available: triState(i.available),
        priceCents: toCents(i.price_reais),
        package: typeof i.package === "string" && i.package.trim() ? i.package.trim() : undefined,
        farmaciaPopular: triState(i.farmacia_popular),
      }))
      .filter((i) => i.medication);
    const note = typeof args.note === "string" && args.note.trim() ? args.note.trim() : undefined;
    this.answer = { items, note };
    this.log(`pharmacy answer recorded: ${items.length} items`);
    this.toolOutput(callId, { recorded: true });
    this.assistantAfterAnswer = "";
    // The model says goodbye while the answer is recorded: if it already did, hang up shortly.
    const lastAssistant = [...this.transcript].reverse().find((l) => l.speaker === "assistant");
    if (lastAssistant && GOODBYE.test(lastAssistant.text)) this.armGoodbyeHangup(this.opts.goodbyeTailMs ?? 2500);
    else this.armSilenceHangup();
  }

  private toolOutput(callId: string, output: unknown) {
    this.send({
      type: "response.item.create",
      event_id: `result_${callId}`,
      item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) },
    });
    this.send({ type: "response.create", event_id: `continue_${callId}` });
  }

  private onAssistantSpeech(delta: string) {
    if (!delta) return;
    this.appendTranscript("assistant", delta);
    if (/assistente virtual/i.test(this.transcript.at(-1)?.text ?? "")) this.introduced = true;
    if (this.menuPending) {
      // The model sometimes says the option instead of delegating the key press: press it for it.
      this.assistantSinceMenu += delta;
      const key = spokenChoice(this.assistantSinceMenu);
      if (key) {
        this.log(`assistant said option ${key} aloud, pressing it`);
        this.sendKeys(`spoken_${this.keysPressed.length}`, [key]);
      }
    }
    if (!this.answer) return;
    this.assistantAfterAnswer += delta;
    if (!GOODBYE.test(this.assistantAfterAnswer)) {
      this.armSilenceHangup();
      return;
    }
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.armGoodbyeHangup(this.opts.goodbyeTailMs ?? 2500);
  }

  private armSilenceHangup() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      this.endReason ??= "hung_up_after_answer";
      void this.endCall();
    }, this.opts.goodbyeMs ?? 5000);
    this.timers.push(this.silenceTimer);
  }

  private armGoodbyeHangup(ms: number) {
    if (this.goodbyeTimer) clearTimeout(this.goodbyeTimer);
    this.goodbyeTimer = setTimeout(() => {
      this.endReason ??= "hung_up_after_goodbye";
      void this.endCall();
    }, ms);
    this.timers.push(this.goodbyeTimer);
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

  private outcome(): PharmacyCallOutcome {
    if (this.answer) return "answered";
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
    this.resolveResult({
      sessionId: this.opts.sessionId,
      outcome: this.outcome(),
      items: this.answer?.items ?? [],
      note: this.answer?.note,
      keysPressed: [...this.keysPressed],
      transcript: this.transcript
        .map((l) => ({ ...l, text: l.text.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim() }))
        .filter((l) => l.text),
      error: this.error,
      durationSeconds: this.durationSeconds,
      endReason: this.endReason ?? (this.error ? "error" : undefined),
    });
  }
}

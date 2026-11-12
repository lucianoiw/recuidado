import type { VoiceConfig } from "./config.js";
import { LiveClient } from "./live.js";
import { toE164 } from "./phone.js";
import { greetingLine, type ReminderContext } from "./prompt.js";
import { GreetingCache } from "./greeting-cache.js";
import { ReminderCall, type CallResult, type CallStatus } from "./reminder-call.js";
import { AlertCall } from "./alert-call.js";
import { PharmacyCall, type PharmacyCallResult } from "./pharmacy-call.js";
import type { PharmacyContext } from "./pharmacy-prompt.js";
import { AsteriskVoiceGate, openGate, startRecording, waitForGlobal } from "./ami.js";
import { actorNumber, buildActorInstructions, simGreeting, simPharmacyFor, type SimMedication, type SimPharmacy } from "./sim-pharmacy.js";

/** One step of a call for the calls panel: a log line of the call and when it happened. */
export interface CallEvent {
  atMs: number;
  text: string;
}

/**
 * Keeps the log lines of one call as its timeline (events, function calls, forced lines, keys) and
 * still prints them. Lines look like "2026-11-11T22:50:05.948Z [session] text".
 */
export class CallTrail {
  readonly startedAt = new Date();
  readonly events: CallEvent[] = [];

  constructor(private readonly print: (msg: string, extra?: unknown) => void) {}

  readonly log = (msg: string, extra?: unknown) => {
    if (this.events.length < 500) {
      const text = msg.replace(/^(\S+Z )?\[[^\]]+\] /, "");
      this.events.push({ atMs: Date.now() - this.startedAt.getTime(), text: text.slice(0, 2000) });
    }
    this.print(msg, extra);
  };
}

/** What apps/voice sends to POST /call-logs when a call ends. */
export interface CallLog {
  sessionId: string;
  kind: "reminder" | "recall" | "check_in" | "caregiver" | "pharmacy";
  doseId?: string;
  inquiryId?: string;
  outcome?: string;
  durationSeconds?: number;
  startedAt: string;
  transcript: { speaker: string; text: string }[];
  events: CallEvent[];
}

export interface StartCallInput extends ReminderContext {
  phone: string;
}

export class NumberNotAllowedError extends Error {}

/** Listed numbers, or any Brazilian number when CALL_ALLOWED_NUMBERS has "*". Never international. */
export function isAllowed(config: Pick<VoiceConfig, "allowedNumbers" | "allowAnyBrazilian">, e164: string): boolean {
  return config.allowedNumbers.has(e164) || (config.allowAnyBrazilian && e164.startsWith("+55"));
}

/**
 * Pharmacies are third parties: only numbers listed one by one in CALL_ALLOWED_NUMBERS,
 * never through "*". The demo "pharmacy" is a phone the team controls.
 */
export function isAllowedPharmacy(config: Pick<VoiceConfig, "allowedNumbers">, e164: string): boolean {
  return config.allowedNumbers.has(e164);
}

export interface StartPharmacyCallInput extends PharmacyContext {
  phone: string;
  medications: SimMedication[];
}

export interface StartedPharmacyCall {
  sessionId: string;
  call: PharmacyCall;
  trail: CallTrail;
}

export interface StartedCall {
  sessionId: string;
  call: ReminderCall;
  trail: CallTrail;
}

export class CallService {
  private readonly live: LiveClient;
  private readonly greetings: GreetingCache;

  constructor(
    private readonly config: VoiceConfig,
    private readonly log: (msg: string, extra?: unknown) => void = console.log,
  ) {
    this.live = new LiveClient(config);
    this.greetings = new GreetingCache(config.greetingCacheDir);
  }

  async start(input: StartCallInput, onStatusChange?: (status: CallStatus) => void): Promise<StartedCall> {
    const destination = toE164(input.phone);
    if (!isAllowed(this.config, destination)) {
      throw new NumberNotAllowedError(`Number ${destination} is not in CALL_ALLOWED_NUMBERS`);
    }
    const context: ReminderContext = {
      patientName: input.patientName,
      medications: input.medications,
      checkIn: input.checkIn,
      callBack: input.callBack,
      gender: input.gender,
      doseTime: input.doseTime,
      recall: input.recall,
      recallLater: input.recallLater,
    };
    const now = new Date();
    const line = greetingLine(context, now);
    const greetingAudio = this.greetings.get(this.config.liveVoice, line);
    const trail = new CallTrail(this.log);
    const sessionId = await this.live.createSipCall(destination, context, greetingAudio ? line : undefined);
    this.log(`call created ${sessionId}${greetingAudio ? " (recorded greeting)" : ""}`);
    // Attach right away: the sideband only replays the previous 3 seconds of call progress.
    const socket = this.live.attach(sessionId);
    this.record(destination, sessionId, trail);
    const call = new ReminderCall({
      sessionId,
      context,
      socket,
      hangup: () => this.live.hangup(sessionId),
      maxCallMs: this.config.maxCallSeconds * 1000,
      log: trail.log,
      onStatusChange,
      now,
      greetingAudio,
      onGreetingRecorded: (spoken, audio) => {
        if (this.greetings.set(this.config.liveVoice, spoken, audio)) {
          this.log(`greeting recorded for later calls (${(audio.length / 48_000).toFixed(1)} s)`);
        }
      },
    });
    return { sessionId, call, trail };
  }

  /** Calls a family member with an urgent message. Same allowlist as reminder calls. */
  async startAlert(phone: string, message: string): Promise<{ sessionId: string; call: AlertCall; trail: CallTrail }> {
    const destination = toE164(phone);
    if (!isAllowed(this.config, destination)) {
      throw new NumberNotAllowedError(`Number ${destination} is not in CALL_ALLOWED_NUMBERS`);
    }
    const trail = new CallTrail(this.log);
    const sessionId = await this.live.createAlertSipCall(destination, message);
    this.log(`alert call created ${sessionId}`);
    const socket = this.live.attach(sessionId);
    this.record(destination, sessionId, trail);
    const call = new AlertCall({
      sessionId,
      message,
      socket,
      hangup: () => this.live.hangup(sessionId),
      maxCallMs: 60_000,
      log: trail.log,
    });
    return { sessionId, call, trail };
  }

  async startPharmacy(input: StartPharmacyCallInput): Promise<StartedPharmacyCall> {
    const destination = toE164(input.phone);
    if (!isAllowedPharmacy(this.config, destination)) {
      throw new NumberNotAllowedError(`Pharmacy number ${destination} is not listed in CALL_ALLOWED_NUMBERS`);
    }
    const context: PharmacyContext = { medications: input.medications };
    const trail = new CallTrail(this.log);
    const { sessionId, decisions, decisionsError } = await this.live.createPharmacySipCall(destination, context);
    if (decisionsError) this.log(`pharmacy call: Decisions triggers rejected, calling without them: ${decisionsError}`);
    this.log(`pharmacy call created ${sessionId} (decisions ${decisions ? "on" : "off"}, voice gate ${this.config.ami ? "on" : "off"})`);
    const socket = this.live.attach(sessionId);
    this.record(destination, sessionId, trail);
    // The dialplan keys the AI's channel by the national number (DDD + number).
    const gate = this.config.ami
      ? new AsteriskVoiceGate(this.config.ami, destination.replace(/^\+55/, ""), (m) => trail.log(`[${sessionId}] ${m}`))
      : openGate;
    const call = new PharmacyCall({
      sessionId,
      context,
      socket,
      gate,
      hangup: () => this.live.hangup(sessionId),
      // Recorded menus take time: allow a bit longer than a reminder call, and 40 s more for each
      // extra medicine (about one question, the prices and the read-back).
      maxCallMs: (Math.max(this.config.maxCallSeconds, 180) + 40 * (input.medications.length - 1)) * 1000,
      log: trail.log,
    });
    // A simulated pharmacy: its attendant is a second AI, dialed now so it is ringing when the
    // assistant gets past the menu. No real pharmacy is called.
    const sim = simPharmacyFor(destination);
    if (sim) void this.startActor(sim, input.medications, sessionId, call);
    return { sessionId, call, trail };
  }

  /**
   * Asks Asterisk to record the call (calls panel). Runs on the side: the call never waits for it.
   * The dialplan keys the AI's channel by the national number (DDD + number).
   */
  private record(destination: string, sessionId: string, trail: CallTrail) {
    if (!this.config.ami || !this.config.recordCalls) return;
    void startRecording(this.config.ami, destination.replace(/^\+55/, ""), sessionId, (m) => trail.log(`[${sessionId}] ${m}`));
  }

  /** Sends the transcript and the timeline of a call to the calls panel. */
  reportLog(log: CallLog): Promise<void> {
    return this.post("/call-logs", log);
  }

  /** The attendant AI of a simulated pharmacy. Hangs up when the pharmacy call ends. Never throws. */
  private async startActor(sim: SimPharmacy, meds: SimMedication[], callerId: string, call: PharmacyCall) {
    let ended = false;
    void call.result.finally(() => (ended = true));
    try {
      // Dial only when the caller gets past the menu (the line rings there), so the actor's call
      // never times out ringing during a long menu or hold.
      if (this.config.ami && !(await waitForGlobal(this.config.ami, `SIM_READY_${sim.index}`, () => ended))) return;
      const actorId = await this.live.createActorSipCall(
        actorNumber(sim),
        buildActorInstructions(sim, meds),
        simGreeting(sim),
      );
      this.log(`[${callerId}] simulated pharmacy ${sim.index} (${sim.name}): actor ${actorId}`);
      this.watchActor(actorId, callerId);
      const hangup = () => this.live.hangup(actorId).catch((err: Error) => this.log(`actor hangup: ${err.message}`));
      // At most 5 minutes, even if the pharmacy call never reports an end.
      const timer = setTimeout(hangup, 5 * 60 * 1000);
      void call.result.finally(() => {
        clearTimeout(timer);
        void hangup();
      });
    } catch (err) {
      this.log(`[${callerId}] simulated pharmacy ${sim.index}: actor not started: ${(err as Error).message}`);
    }
  }

  /** Logs the actor's errors and how its session ended, to see why an attendant goes quiet. */
  private watchActor(actorId: string, callerId: string) {
    try {
      const socket = this.live.attach(actorId);
      // What the attendant says and hears, one line per utterance: tells "the attendant never spoke"
      // apart from "the caller's transcription lost it".
      const lines = { said: "", heard: "" };
      const timers: Partial<Record<keyof typeof lines, NodeJS.Timeout>> = {};
      const add = (kind: keyof typeof lines, delta: string) => {
        lines[kind] += delta;
        if (timers[kind]) clearTimeout(timers[kind]);
        timers[kind] = setTimeout(() => {
          if (lines[kind].trim()) this.log(`[${callerId}] actor ${kind}: ${lines[kind].trim()}`);
          lines[kind] = "";
        }, 1200);
      };
      socket.on("message", (data) => {
        let event: { type?: string; error?: unknown; reason?: unknown; delta?: unknown };
        try {
          event = JSON.parse(String(data));
        } catch {
          return;
        }
        if (event.type === "session.output_transcript.delta" && typeof event.delta === "string") add("said", event.delta);
        if (event.type === "session.input_transcript.delta" && typeof event.delta === "string") add("heard", event.delta);
        if (event.type === "error") this.log(`[${callerId}] actor error ${JSON.stringify(event.error)}`);
        if (event.type?.startsWith("transport.") && !event.type.includes("dtmf")) this.log(`[${callerId}] actor ${event.type}`);
        if (event.type === "session.closed") {
          this.log(`[${callerId}] actor session closed: ${String(event.reason ?? "unknown")}`);
          socket.close();
        }
      });
      socket.on("error", (err) => this.log(`[${callerId}] actor sideband: ${err.message}`));
    } catch (err) {
      this.log(`[${callerId}] actor sideband not attached: ${(err as Error).message}`);
    }
  }

  /** Sends the result to the Recuidado API, which alerts the family when confirmed is false. */
  report(doseId: string, result: CallResult & { checkIn?: boolean; recall?: boolean }): Promise<void> {
    return this.post(`/doses/${encodeURIComponent(doseId)}/voice-result`, result);
  }

  /** Tells the Recuidado API how an emergency call to a caregiver ended; not delivered calls the next one. */
  reportAlert(
    doseId: string,
    result: { sessionId: string; memberId: string; message: string; answered: boolean; delivered: boolean },
  ): Promise<void> {
    return this.post(`/doses/${encodeURIComponent(doseId)}/alert-call-result`, result);
  }

  /** Sends what the pharmacy said to the Recuidado API. */
  reportPharmacy(inquiryId: string, result: PharmacyCallResult): Promise<void> {
    return this.post(`/pharmacy-inquiries/${encodeURIComponent(inquiryId)}/voice-result`, result);
  }

  private async post(path: string, result: unknown): Promise<void> {
    if (!this.config.apiUrl) {
      this.log(`no API_URL set, result for ${path}`, result);
      return;
    }
    const url = `${this.config.apiUrl.replace(/\/$/, "")}${path}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    headers.Authorization = `Bearer ${this.config.voiceApiToken}`;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(result) });
        if (res.ok) return;
        this.log(`voice-result POST returned ${res.status} (attempt ${attempt})`);
      } catch (err) {
        this.log(`voice-result POST failed (attempt ${attempt})`, (err as Error).message);
      }
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
  }
}

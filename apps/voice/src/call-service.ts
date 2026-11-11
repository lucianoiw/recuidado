import type { VoiceConfig } from "./config.js";
import { LiveClient } from "./live.js";
import { toE164 } from "./phone.js";
import type { ReminderContext } from "./prompt.js";
import { ReminderCall, type CallResult } from "./reminder-call.js";

export interface StartCallInput extends ReminderContext {
  phone: string;
}

export class NumberNotAllowedError extends Error {}

export interface StartedCall {
  sessionId: string;
  call: ReminderCall;
}

export class CallService {
  private readonly live: LiveClient;

  constructor(
    private readonly config: VoiceConfig,
    private readonly log: (msg: string, extra?: unknown) => void = console.log,
  ) {
    this.live = new LiveClient(config);
  }

  async start(input: StartCallInput): Promise<StartedCall> {
    const destination = toE164(input.phone);
    if (!this.config.allowedNumbers.has(destination)) {
      throw new NumberNotAllowedError(`Number ${destination} is not in CALL_ALLOWED_NUMBERS`);
    }
    const context: ReminderContext = { patientName: input.patientName, medications: input.medications };
    const sessionId = await this.live.createSipCall(destination, context);
    this.log(`call created ${sessionId}`);
    // Attach right away: the sideband only replays the previous 3 seconds of call progress.
    const socket = this.live.attach(sessionId);
    const call = new ReminderCall({
      sessionId,
      context,
      socket,
      hangup: () => this.live.hangup(sessionId),
      maxCallMs: this.config.maxCallSeconds * 1000,
      log: this.log,
    });
    return { sessionId, call };
  }

  /** Sends the result to the Recuidado API, which alerts the family when confirmed is false. */
  async report(doseId: string, result: CallResult): Promise<void> {
    if (!this.config.apiUrl) {
      this.log(`no API_URL set, result for dose ${doseId}`, result);
      return;
    }
    const url = `${this.config.apiUrl.replace(/\/$/, "")}/doses/${encodeURIComponent(doseId)}/voice-result`;
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

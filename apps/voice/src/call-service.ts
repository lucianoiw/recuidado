import type { VoiceConfig } from "./config.js";
import { LiveClient } from "./live.js";
import { toE164 } from "./phone.js";
import type { ReminderContext } from "./prompt.js";
import { ReminderCall, type CallResult, type CallStatus } from "./reminder-call.js";
import { PharmacyCall, type PharmacyCallResult } from "./pharmacy-call.js";
import type { PharmacyContext } from "./pharmacy-prompt.js";

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
}

export interface StartedPharmacyCall {
  sessionId: string;
  call: PharmacyCall;
}

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

  async start(input: StartCallInput, onStatusChange?: (status: CallStatus) => void): Promise<StartedCall> {
    const destination = toE164(input.phone);
    if (!isAllowed(this.config, destination)) {
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
      onStatusChange,
    });
    return { sessionId, call };
  }

  async startPharmacy(input: StartPharmacyCallInput): Promise<StartedPharmacyCall> {
    const destination = toE164(input.phone);
    if (!isAllowedPharmacy(this.config, destination)) {
      throw new NumberNotAllowedError(`Pharmacy number ${destination} is not listed in CALL_ALLOWED_NUMBERS`);
    }
    const context: PharmacyContext = { medications: input.medications };
    const sessionId = await this.live.createPharmacySipCall(destination, context);
    this.log(`pharmacy call created ${sessionId}`);
    const socket = this.live.attach(sessionId);
    const call = new PharmacyCall({
      sessionId,
      context,
      socket,
      hangup: () => this.live.hangup(sessionId),
      // Recorded menus take time: allow a bit longer than a reminder call.
      maxCallMs: Math.max(this.config.maxCallSeconds, 180) * 1000,
      log: this.log,
    });
    return { sessionId, call };
  }

  /** Sends the result to the Recuidado API, which alerts the family when confirmed is false. */
  report(doseId: string, result: CallResult): Promise<void> {
    return this.post(`/doses/${encodeURIComponent(doseId)}/voice-result`, result);
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

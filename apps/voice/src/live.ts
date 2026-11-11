import WebSocket from "ws";
import type { VoiceConfig } from "./config.js";
import {
  buildDelegateInstructions,
  buildGreeting,
  buildLiveInstructions,
  buildRecordedGreetingNote,
  doseTool,
  type ReminderContext,
} from "./prompt.js";
import { buildAlertInstructions } from "./alert-call.js";
import {
  buildPharmacyDelegateInstructions,
  buildPharmacyLiveInstructions,
  keypadTool,
  pharmacyTool,
  pharmacyTriggers,
  type PharmacyContext,
} from "./pharmacy-prompt.js";

const API_BASE = "https://api.openai.com/v1";

export class LiveApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
  }
}

/** Minimal client for the GPT-Live endpoints used by outbound SIP calls. */
export class LiveClient {
  constructor(private readonly config: VoiceConfig) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.openaiApiKey}`,
      "Content-Type": "application/json",
    };
  }

  /** Reasoning settings for delegated requests; low effort keeps the answer recorded within a couple of seconds. */
  private delegateReasoning() {
    return this.config.delegateReasoningEffort ? { reasoning: { effort: this.config.delegateReasoningEffort } } : {};
  }

  /** recordedGreeting: the greeting line when its recording will play on answer, so the model does not say it. */
  buildSessionRequest(destination: string, ctx: ReminderContext, recordedGreeting?: string) {
    return {
      session: {
        model: this.config.liveModel,
        instructions: buildLiveInstructions(ctx),
        audio: { output: { voice: this.config.liveVoice } },
        input: [
          {
            type: "message",
            role: "developer",
            content: [
              {
                type: "input_text",
                text: recordedGreeting ? buildRecordedGreetingNote(recordedGreeting) : buildGreeting(ctx),
              },
            ],
          },
        ],
        delegation: {
          type: "responses",
          responses: {
            model: this.config.delegateModel,
            instructions: buildDelegateInstructions(ctx),
            ...this.delegateReasoning(),
            tools: [doseTool],
            tool_choice: "required",
            parallel_tool_calls: false,
          },
        },
      },
      transport: this.sipTransport(destination),
    };
  }

  private sipTransport(destination: string) {
    const { sip } = this.config;
    return {
      type: "sip",
      destination,
      trunk: {
        provider_url: sip.providerUrl,
        auth: { type: "digest", username: sip.username, password: sip.password },
        caller_number: sip.callerNumber,
      },
    };
  }

  /** A call to a pharmacy: no greeting input, the other side speaks first. Two tools: keypad and answer. */
  buildPharmacySessionRequest(destination: string, ctx: PharmacyContext, decisions = this.config.pharmacyDecisions) {
    return {
      session: {
        model: this.config.liveModel,
        instructions: buildPharmacyLiveInstructions(ctx),
        audio: { output: { voice: this.config.liveVoice } },
        ...(decisions ? { triggers: pharmacyTriggers } : {}),
        delegation: {
          type: "responses",
          responses: {
            model: this.config.delegateModel,
            instructions: buildPharmacyDelegateInstructions(ctx),
            tools: [keypadTool, pharmacyTool],
            tool_choice: "required",
            parallel_tool_calls: false,
          },
        },
      },
      transport: this.sipTransport(destination),
    };
  }

  /** A one-way urgent message to a family member: no tools, no delegation. */
  buildAlertSessionRequest(destination: string, message: string) {
    return {
      session: {
        model: this.config.liveModel,
        instructions: buildAlertInstructions(message),
        audio: { output: { voice: this.config.liveVoice } },
      },
      transport: this.sipTransport(destination),
    };
  }

  /** Places an alert call. Not idempotent, like createSipCall. */
  createAlertSipCall(destination: string, message: string): Promise<string> {
    return this.createSession(this.buildAlertSessionRequest(destination, message));
  }

  /**
   * Places a call to a pharmacy. Not idempotent, like createSipCall. If the API rejects the
   * Decisions triggers (400 places no call), retries once without them: the word rules still work.
   */
  async createPharmacySipCall(destination: string, ctx: PharmacyContext): Promise<{ sessionId: string; decisions: boolean; decisionsError?: string }> {
    const decisions = this.config.pharmacyDecisions;
    try {
      return { sessionId: await this.createSession(this.buildPharmacySessionRequest(destination, ctx, decisions)), decisions };
    } catch (err) {
      if (decisions && err instanceof LiveApiError && err.status === 400 && /trigger|decision/i.test(err.body)) {
        const sessionId = await this.createSession(this.buildPharmacySessionRequest(destination, ctx, false));
        return { sessionId, decisions: false, decisionsError: err.body.slice(0, 500) };
      }
      throw err;
    }
  }

  /**
   * Places the outbound call. Not idempotent: every successful request dials again,
   * so callers must not retry blindly on timeouts.
   */
  async createSipCall(destination: string, ctx: ReminderContext, recordedGreeting?: string): Promise<string> {
    const request = this.buildSessionRequest(destination, ctx, recordedGreeting);
    try {
      return await this.createSession(request);
    } catch (err) {
      // A 400 places no call, so retrying once without the reasoning setting is safe.
      if (err instanceof LiveApiError && err.status === 400 && /reasoning/i.test(err.body)) {
        delete (request.session.delegation.responses as { reasoning?: unknown }).reasoning;
        return this.createSession(request);
      }
      throw err;
    }
  }

  private async createSession(request: unknown): Promise<string> {
    const res = await fetch(`${API_BASE}/live/sessions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(request),
    });
    const body = await res.text();
    if (!res.ok) throw new LiveApiError(`Create session failed with ${res.status}`, res.status, body);
    const id = (JSON.parse(body) as { session?: { id?: string } }).session?.id;
    if (!id) throw new LiveApiError("Create session returned no session id", res.status, body);
    return id;
  }

  /** Opens the sideband WebSocket that carries call progress, transcripts and tool calls. */
  attach(sessionId: string): WebSocket {
    return new WebSocket(`wss://api.openai.com/v1/live/sessions/${encodeURIComponent(sessionId)}/attach`, {
      headers: { Authorization: `Bearer ${this.config.openaiApiKey}` },
    });
  }

  async hangup(sessionId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/live/sessions/${encodeURIComponent(sessionId)}/hangup`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.openaiApiKey}` },
    });
    if (!res.ok && res.status !== 404) {
      throw new LiveApiError(`Hangup failed with ${res.status}`, res.status, await res.text());
    }
  }
}

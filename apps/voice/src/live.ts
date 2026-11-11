import WebSocket from "ws";
import type { VoiceConfig } from "./config.js";
import {
  buildDelegateInstructions,
  buildGreeting,
  buildLiveInstructions,
  doseTool,
  type ReminderContext,
} from "./prompt.js";

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

  buildSessionRequest(destination: string, ctx: ReminderContext) {
    const { sip } = this.config;
    return {
      session: {
        model: this.config.liveModel,
        instructions: buildLiveInstructions(ctx),
        audio: { output: { voice: this.config.liveVoice } },
        input: [
          {
            type: "message",
            role: "developer",
            content: [{ type: "input_text", text: buildGreeting(ctx) }],
          },
        ],
        delegation: {
          type: "responses",
          responses: {
            model: this.config.delegateModel,
            instructions: buildDelegateInstructions(),
            tools: [doseTool],
            tool_choice: "required",
            parallel_tool_calls: false,
          },
        },
      },
      transport: {
        type: "sip",
        destination,
        trunk: {
          provider_url: sip.providerUrl,
          auth: { type: "digest", username: sip.username, password: sip.password },
          caller_number: sip.callerNumber,
        },
      },
    };
  }

  /**
   * Places the outbound call. Not idempotent: every successful request dials again,
   * so callers must not retry blindly on timeouts.
   */
  async createSipCall(destination: string, ctx: ReminderContext): Promise<string> {
    const res = await fetch(`${API_BASE}/live/sessions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.buildSessionRequest(destination, ctx)),
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

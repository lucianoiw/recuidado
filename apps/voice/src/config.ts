import { toE164 } from "./phone.js";

export interface VoiceConfig {
  openaiApiKey: string;
  liveModel: string;
  liveVoice: string;
  delegateModel: string;
  sip: {
    providerUrl: string;
    username: string;
    password: string;
    callerNumber: string;
  };
  /** Destinations this service may dial. The demo must never call anyone else. */
  allowedNumbers: Set<string>;
  maxCallSeconds: number;
  port: number;
  voiceApiToken: string;
  apiUrl?: string;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): VoiceConfig {
  const providerUrl = required(env, "SIP_PROVIDER_URL");
  if (!providerUrl.startsWith("sips:")) {
    throw new Error("SIP_PROVIDER_URL must use sips: (GPT-Live only dials over TLS)");
  }
  const allowed = (env.CALL_ALLOWED_NUMBERS ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .map(toE164);
  if (allowed.length === 0) {
    throw new Error("CALL_ALLOWED_NUMBERS must list at least one number");
  }
  return {
    openaiApiKey: required(env, "OPENAI_API_KEY"),
    liveModel: env.OPENAI_LIVE_MODEL?.trim() || "gpt-live-1",
    liveVoice: env.OPENAI_LIVE_VOICE?.trim() || "bossa",
    delegateModel: env.OPENAI_DELEGATE_MODEL?.trim() || "gpt-6-luna",
    sip: {
      providerUrl,
      username: env.OPENAI_SIP_USERNAME?.trim() || "openai",
      password: required(env, "OPENAI_SIP_PASSWORD"),
      callerNumber: toE164(required(env, "SIP_CALLER_NUMBER")),
    },
    allowedNumbers: new Set(allowed),
    maxCallSeconds: Number(env.CALL_MAX_SECONDS ?? 150),
    port: Number(env.PORT ?? 5000),
    voiceApiToken: required(env, "VOICE_API_TOKEN"),
    apiUrl: env.API_URL?.trim() || undefined,
  };
}

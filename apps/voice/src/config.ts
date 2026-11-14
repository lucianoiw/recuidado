import { toE164 } from "./phone.js";
import { defaultGateway, type AmiConfig } from "./ami.js";

export interface VoiceConfig {
  openaiApiKey: string;
  liveModel: string;
  liveVoice: string;
  /** Voice of the attendant AI in the simulated pharmacies (another voice than the assistant's). */
  actorVoice: string;
  /** Voice of the simulated patient (sim-patient.ts). */
  patientActorVoice: string;
  delegateModel: string;
  /** Reasoning effort for the delegated model; empty leaves the model default. */
  delegateReasoningEffort?: string;
  /** Where recorded greetings are kept between calls. */
  greetingCacheDir?: string;
  sip: {
    providerUrl: string;
    username: string;
    password: string;
    callerNumber: string;
  };
  /** Destinations this service may dial. The demo must never call anyone else. */
  allowedNumbers: Set<string>;
  /** CALL_ALLOWED_NUMBERS=* : any Brazilian number. The API limits how many calls are made. */
  allowAnyBrazilian: boolean;
  maxCallSeconds: number;
  port: number;
  voiceApiToken: string;
  apiUrl?: string;
  /** Asterisk Manager Interface, to mute the AI toward a recorded menu. Off when no secret is set. */
  ami?: AmiConfig;
  /** Classify the other side of a pharmacy call (menu, hold, person...) with GPT-Live Decisions. */
  pharmacyDecisions: boolean;
  /** Record every call in Asterisk (MixMonitor through AMI) for the calls panel. Needs ami. */
  recordCalls: boolean;
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
  const entries = (env.CALL_ALLOWED_NUMBERS ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const allowAnyBrazilian = entries.includes("*");
  const allowed = entries.filter((n) => n !== "*").map(toE164);
  if (allowed.length === 0 && !allowAnyBrazilian) {
    throw new Error("CALL_ALLOWED_NUMBERS must list at least one number");
  }
  return {
    openaiApiKey: required(env, "OPENAI_API_KEY"),
    liveModel: env.OPENAI_LIVE_MODEL?.trim() || "gpt-live-1",
    liveVoice: env.OPENAI_LIVE_VOICE?.trim() || "bossa",
    actorVoice: env.PHARMACY_ACTOR_VOICE?.trim() || "tempo",
    patientActorVoice: env.PATIENT_ACTOR_VOICE?.trim() || env.PHARMACY_ACTOR_VOICE?.trim() || "tempo",
    delegateModel: env.OPENAI_DELEGATE_MODEL?.trim() || "gpt-6-luna",
    delegateReasoningEffort: env.OPENAI_DELEGATE_REASONING_EFFORT?.trim() ?? "low",
    greetingCacheDir: env.GREETING_CACHE_DIR?.trim() || "/tmp/recuidado-greetings",
    sip: {
      providerUrl,
      username: env.OPENAI_SIP_USERNAME?.trim() || "openai",
      password: required(env, "OPENAI_SIP_PASSWORD"),
      callerNumber: toE164(required(env, "SIP_CALLER_NUMBER")),
    },
    allowedNumbers: new Set(allowed),
    allowAnyBrazilian,
    maxCallSeconds: Number(env.CALL_MAX_SECONDS ?? 150),
    port: Number(env.PORT ?? 5000),
    voiceApiToken: required(env, "VOICE_API_TOKEN"),
    apiUrl: env.API_URL?.trim() || undefined,
    ami: loadAmi(env),
    pharmacyDecisions: (env.PHARMACY_DECISIONS?.trim() || "on") !== "off",
    recordCalls: (env.RECORD_CALLS?.trim() || "on") !== "off",
  };
}

function loadAmi(env: NodeJS.ProcessEnv): AmiConfig | undefined {
  const secret = env.ASTERISK_AMI_SECRET?.trim();
  if (!secret) return undefined;
  const host = env.ASTERISK_AMI_HOST?.trim() || defaultGateway();
  if (!host) return undefined;
  return {
    host,
    port: Number(env.ASTERISK_AMI_PORT ?? 5038),
    username: env.ASTERISK_AMI_USER?.trim() || "recuidado",
    secret,
  };
}

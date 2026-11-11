import { z } from 'zod';

// All secrets come from environment variables. Never commit real values.
// Docker Compose passes unset optional variables as empty strings.
const optionalUrl = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().url().optional(),
);

const optionalString = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().optional(),
);

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  VOICE_URL: optionalUrl,
  // Shared secret with apps/voice: sent on POST /calls and expected on POST /doses/:id/voice-result.
  VOICE_API_TOKEN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(16).optional(),
  ),
  // Prescription reading (packages/prescription-reader). Without it, POST /prescriptions/parse answers 503.
  ANTHROPIC_API_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().optional(),
  ),
  // Web Push (VAPID). Without the keys, pushes are skipped and only logged.
  VAPID_PUBLIC_KEY: optionalString,
  VAPID_PRIVATE_KEY: optionalString,
  VAPID_SUBJECT: z.string().default('https://recuidado.com.br'),
  // Minutes to wait for a dose confirmation before calling the patient.
  DOSE_CALL_AFTER_MINUTES: z.coerce.number().int().positive().default(15),
  // Reminder calls cost money (Nvoip + OpenAI). Limits over the last 24 hours:
  // per family (the demo family is exempt) and for the whole app. 0 turns calls off.
  CALL_DAILY_LIMIT_PER_FAMILY: z.coerce.number().int().nonnegative().default(3),
  CALL_DAILY_LIMIT_TOTAL: z.coerce.number().int().nonnegative().default(20),
  // Minutes to wait after the call before alerting the family.
  DOSE_ALERT_AFTER_MINUTES: z.coerce.number().int().positive().default(30),
  // Demo run (POST /demo/run): the whole dose flow in about two minutes. "false" turns it off.
  DEMO_RUN_ENABLED: z.preprocess(
    (v) => (v === '' || v === undefined ? true : v !== 'false' && v !== false),
    z.boolean(),
  ),
  // Seconds after the demo reminder before the call.
  DEMO_CALL_AFTER_SECONDS: z.coerce.number().int().positive().default(20),
  // Seconds after the demo call starts before the family is alerted if the call never reports back.
  DEMO_ALERT_AFTER_SECONDS: z.coerce.number().int().positive().default(100),
  // The family is told a medicine is running out when this many days of pills or fewer are left.
  LOW_STOCK_DAYS: z.coerce.number().int().positive().default(5),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

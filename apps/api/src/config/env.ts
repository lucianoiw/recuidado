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
  // Claude model that reads prescriptions. Empty uses the reader's default.
  PRESCRIPTION_MODEL: optionalString,
  // Prescription reading is open (no login) and each read costs money (about US$ 0.06).
  // Reads allowed in 24 hours per IP, per family and in total. 0 turns that limit off; total 0 turns reading off.
  PRESCRIPTION_LIMIT_PER_IP: z.coerce.number().int().nonnegative().default(10),
  PRESCRIPTION_LIMIT_PER_FAMILY: z.coerce.number().int().nonnegative().default(10),
  PRESCRIPTION_LIMIT_TOTAL: z.coerce.number().int().nonnegative().default(100),
  // Requests per minute from one IP, for every route (health check excluded). 0 turns it off.
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().nonnegative().default(300),
  // Reverse proxies in front of the API (Traefik in Coolify), so the client IP comes from X-Forwarded-For.
  TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(1),
  // Web Push (VAPID). Without the keys, pushes are skipped and only logged.
  VAPID_PUBLIC_KEY: optionalString,
  VAPID_PRIVATE_KEY: optionalString,
  VAPID_SUBJECT: z.string().default('https://recuidado.com.br'),
  // Family alerts by e-mail (Resend). Without the key, e-mails are skipped and only logged.
  RESEND_API_KEY: optionalString,
  // Sender of the alert e-mails. The domain must be verified in Resend.
  EMAIL_FROM: z.string().default('Recuidado <avisos@recuidado.com.br>'),
  // Comma-separated addresses that get the demo family alerts (its caregivers are synthetic). Empty: no e-mail for the demo.
  DEMO_ALERT_EMAILS: optionalString,
  // Minutes to wait for a dose confirmation before calling the patient.
  DOSE_CALL_AFTER_MINUTES: z.coerce.number().int().positive().default(15),
  // Reminder calls cost money (Nvoip + OpenAI). Limits over the last 24 hours:
  // per family (the demo family is exempt) and for the whole app. 0 turns calls off.
  CALL_DAILY_LIMIT_PER_FAMILY: z.coerce.number().int().nonnegative().default(3),
  CALL_DAILY_LIMIT_TOTAL: z.coerce.number().int().nonnegative().default(20),
  // Days a call transcript (and what she said about how she feels) is kept. After that only the outcome stays.
  VOICE_TRANSCRIPT_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  // "Perguntar à farmácia": the only number the pharmacy call dials (also listed in CALL_ALLOWED_NUMBERS
  // of apps/voice). A phone the team controls, never a real pharmacy. Empty turns the feature off.
  PHARMACY_CALL_PHONE: optionalString,
  // Name the family screen shows for that number.
  PHARMACY_CALL_NAME: z.string().default('Farmácia de teste'),
  // Minutes to wait after the call before alerting the family.
  DOSE_ALERT_AFTER_MINUTES: z.coerce.number().int().positive().default(30),
  // After she reports an emergency on a call, Recuidado calls her back this many minutes later.
  EMERGENCY_CHECKIN_MINUTES: z.coerce.number().int().positive().default(10),
  // She said on the call she has not taken the dose yet: Recuidado calls once more this many minutes later
  // before alerting the family. Not for demo run doses, which keep the two-minute flow.
  DOSE_RECALL_MINUTES: z.coerce.number().int().positive().default(15),
  // Demo run (POST /demo/run): the whole dose flow in about two minutes. "false" turns it off.
  DEMO_RUN_ENABLED: z.preprocess(
    (v) => (v === '' || v === undefined ? true : v !== 'false' && v !== false),
    z.boolean(),
  ),
  // On boot, bring the demo family to its fixed story (3 medicines, times, stock, a week of history). "false" turns it off.
  DEMO_SEED_ENABLED: z.preprocess(
    (v) => (v === '' || v === undefined ? true : v !== 'false' && v !== false),
    z.boolean(),
  ),
  // On boot, delete the demo family alerts created before this time (ISO date), so test calls do not show in the video. The seed puts its own history back.
  DEMO_CLEAR_ALERTS_BEFORE: z.preprocess((v) => (v === '' ? undefined : v), z.iso.datetime({ offset: true }).optional()),
  // Scheduled doses of the demo family also call its phone. Off: only the demo run button calls.
  DEMO_SCHEDULED_CALLS: z.preprocess(
    (v) => v === true || v === 'true',
    z.boolean(),
  ),
  // Seconds a demo run holds the button: a second press in this time follows the same run.
  DEMO_RUN_LOCK_SECONDS: z.coerce.number().int().positive().default(240),
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

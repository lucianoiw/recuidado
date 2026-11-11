import { z } from 'zod';

// All secrets come from environment variables. Never commit real values.
// Docker Compose passes unset optional variables as empty strings.
const optionalUrl = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().url().optional(),
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
  // Minutes to wait for a dose confirmation before calling the patient.
  DOSE_CALL_AFTER_MINUTES: z.coerce.number().int().positive().default(15),
  // Minutes to wait after the call before alerting the family.
  DOSE_ALERT_AFTER_MINUTES: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

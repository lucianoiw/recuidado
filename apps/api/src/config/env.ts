import { z } from 'zod';

// All secrets come from environment variables. Never commit real values.
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  VOICE_URL: z.string().url().optional(),
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

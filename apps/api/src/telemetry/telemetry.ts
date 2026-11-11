import { telemetryFromEnv } from '@recuidado/telemetry';

/**
 * One PostHog client for the whole API: product events, exceptions, LLM
 * generations and logs. A no-op when POSTHOG_PROJECT_TOKEN is not set.
 */
export const telemetry = telemetryFromEnv(process.env.TELEMETRY_SERVICE === 'worker' ? 'worker' : 'api');

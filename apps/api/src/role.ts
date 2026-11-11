/**
 * What this process runs. The same image is deployed twice in Coolify:
 * - api: HTTP routes, migrations and boot tasks (demo family). No queue worker.
 * - worker: the doses queue worker (reminders, calls, family alerts, call backs). Its HTTP port has no domain; it is there for the health check.
 * - all (default, local development): both in one process.
 */
export type AppRole = 'all' | 'api' | 'worker';

export function appRole(env: NodeJS.ProcessEnv = process.env): AppRole {
  const role = env.APP_ROLE?.trim().toLowerCase();
  return role === 'api' || role === 'worker' ? role : 'all';
}

/** True when this process serves the HTTP API and runs the boot tasks. */
export const runsApi = (env: NodeJS.ProcessEnv = process.env) => appRole(env) !== 'worker';

/** True when this process consumes the doses queue. */
export const runsWorker = (env: NodeJS.ProcessEnv = process.env) => appRole(env) !== 'api';

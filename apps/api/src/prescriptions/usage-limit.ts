import { createHash } from 'node:crypto';

/** Counters that expire on their own. Redis in production, a Map in tests. */
export interface CounterStore {
  /** Current values; missing counters are 0. */
  get(keys: string[]): Promise<number[]>;
  /** Adds 1 to each counter. A new counter expires after ttlSeconds. */
  hit(keys: string[], ttlSeconds: number): Promise<void>;
}

export interface UsageLimits {
  perIp: number;
  perFamily: number;
  total: number;
}

export type LimitReason = 'ip' | 'family' | 'total';

const DAY_SECONDS = 24 * 60 * 60;

/** IPs are personal data: only a short hash goes to Redis. */
function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

/**
 * Fixed 24-hour windows per IP, per family and in total. A limit of 0 is off,
 * except the total, where 0 means no reads at all.
 * Returns the limit that was hit, or null after counting the read.
 */
export async function consumeRead(
  store: CounterStore,
  limits: UsageLimits,
  who: { ip: string; familyId?: string | null },
  prefix = 'limit:prescription',
): Promise<LimitReason | null> {
  if (limits.total === 0) return 'total';
  const checks: { reason: LimitReason; key: string; max: number }[] = [
    { reason: 'total', key: `${prefix}:total`, max: limits.total },
  ];
  if (limits.perIp > 0) checks.push({ reason: 'ip', key: `${prefix}:ip:${hashIp(who.ip)}`, max: limits.perIp });
  if (limits.perFamily > 0 && who.familyId) {
    checks.push({ reason: 'family', key: `${prefix}:family:${who.familyId}`, max: limits.perFamily });
  }
  const counts = await store.get(checks.map((c) => c.key));
  const hit = checks.find((c, i) => (counts[i] ?? 0) >= c.max);
  if (hit) return hit.reason;
  await store.hit(
    checks.map((c) => c.key),
    DAY_SECONDS,
  );
  return null;
}

/** What the family reads when a limit is hit. */
export const LIMIT_MESSAGES: Record<LimitReason, string> = {
  ip: 'Você já leu muitas receitas hoje. Tente de novo amanhã ou adicione os remédios um por um.',
  family: 'Esta família já leu muitas receitas hoje. Tente de novo amanhã ou adicione os remédios um por um.',
  total: 'A leitura de receitas atingiu o limite de hoje. Tente de novo amanhã ou adicione os remédios um por um.',
};

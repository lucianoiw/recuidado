import type { HighCostGuide } from '@recuidado/data';

/** Days before a deadline when the screens start reminding the family. */
export const REMIND_DAYS = 30;

export interface HighCostSaved {
  checked: string[];
  /** ISO day the doctor filled the LME form. */
  lmeFilledOn: string | null;
  /** ISO day the state approved it or last renewed it. */
  since: string | null;
}

export interface HighCostStatus extends HighCostSaved {
  /** "first": still asking for it; "renewal": already receiving it. */
  stage: 'first' | 'renewal';
  /** Items of the current stage the family already has, and how many there are. */
  done: number;
  total: number;
  /** Last day to hand in the LME (first request only). */
  lmeDeliverBy: string | null;
  /** Day the next renewal is due, when the leaflet says how often. */
  renewBy: string | null;
  /** What needs action within REMIND_DAYS (or is late), for the reminders on Hoje. */
  due: { kind: 'lme' | 'renewal'; by: string; daysLeft: number } | null;
}

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(day: string, months: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  const wanted = (d.getUTCMonth() + months) % 12;
  d.setUTCMonth(d.getUTCMonth() + months);
  // 31/08 + 6 months is the last day of February, not early March.
  if (d.getUTCMonth() !== wanted) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** Where the family is in the Alto Custo path and the next deadline. `today` is an ISO day in São Paulo. */
export function highCostStatus(saved: HighCostSaved, guide: HighCostGuide, today: string): HighCostStatus {
  const stage = saved.since ? 'renewal' : 'first';
  const items = stage === 'first' ? guide.firstRequest : guide.renewal;
  const checked = saved.checked.filter((id) => items.some((item) => item.id === id));
  const lmeDeliverBy =
    stage === 'first' && saved.lmeFilledOn ? addDays(saved.lmeFilledOn, guide.lmeValidDays) : null;
  const renewBy = saved.since && guide.renewalMonths ? addMonths(saved.since, guide.renewalMonths) : null;
  const next = lmeDeliverBy
    ? { kind: 'lme' as const, by: lmeDeliverBy }
    : renewBy
      ? { kind: 'renewal' as const, by: renewBy }
      : null;
  const daysLeft = next ? daysBetween(today, next.by) : null;
  return {
    ...saved,
    checked,
    stage,
    done: checked.length,
    total: items.length,
    lmeDeliverBy,
    renewBy,
    due: next && daysLeft !== null && daysLeft <= REMIND_DAYS ? { ...next, daysLeft } : null,
  };
}

/** ISO day in São Paulo, where every family of the demo lives. */
export function todayInSaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
}

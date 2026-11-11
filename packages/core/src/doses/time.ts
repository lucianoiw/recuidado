// The demo runs in São Paulo time. Brazil has had no daylight saving since 2019.
export const TIME_ZONE = 'America/Sao_Paulo';
const OFFSET = '-03:00';

/** Local calendar date (YYYY-MM-DD) in São Paulo for an instant. */
export function localDate(at: Date, addDays = 0): string {
  const shifted = new Date(at.getTime() + addDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(shifted);
}

/** Instant for a local date and "HH:MM" in São Paulo, or null if the time is invalid. */
export function localDateTime(date: string, time: string): Date | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!match) return null;
  return new Date(`${date}T${match[1]}:${match[2]}:00${OFFSET}`);
}

/** "HH:MM" in São Paulo for an instant. */
export function localTime(at: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);
}

/** Dose instants for the next `days` local days that are still in the future. */
export function upcomingDoseTimes(times: string[], now: Date, days = 2): Date[] {
  const result: Date[] = [];
  for (let d = 0; d < days; d++) {
    const date = localDate(now, d);
    for (const time of times) {
      const at = localDateTime(date, time);
      if (at && at.getTime() > now.getTime()) result.push(at);
    }
  }
  return result;
}

/** Minutes between the scheduled time and now; negative if early. */
export const minutesSince = (scheduledAt: Date, now = new Date()) =>
  Math.round((now.getTime() - scheduledAt.getTime()) / 60000);

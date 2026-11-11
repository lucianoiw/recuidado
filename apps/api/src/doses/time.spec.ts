import { localDate, localDateTime, localTime, upcomingDoseTimes } from './time.js';

describe('dose times in São Paulo', () => {
  it('uses the local date, not UTC', () => {
    // 01:30 UTC on Nov 12 is still Nov 11 in São Paulo.
    expect(localDate(new Date('2026-11-12T01:30:00Z'))).toBe('2026-11-11');
  });

  it('builds the instant for a local time', () => {
    expect(localDateTime('2026-11-11', '08:00')?.toISOString()).toBe('2026-11-11T11:00:00.000Z');
    expect(localDateTime('2026-11-11', '8h')).toBeNull();
  });

  it('formats a local time', () => {
    expect(localTime(new Date('2026-11-11T23:00:00Z'))).toBe('20:00');
  });

  it('keeps only future doses of today and tomorrow', () => {
    const now = new Date('2026-11-11T15:00:00Z'); // 12:00 local
    const times = upcomingDoseTimes(['08:00', '20:00'], now).map((d) => d.toISOString());
    expect(times).toEqual([
      '2026-11-11T23:00:00.000Z',
      '2026-11-12T11:00:00.000Z',
      '2026-11-12T23:00:00.000Z',
    ]);
  });
});

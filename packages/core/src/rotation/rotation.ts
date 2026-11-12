// Monthly rotation: each month one caregiver buys the medicines, in the order the family chose.
// Pure functions, shared by the API (month screen) and the worker (the "your turn" alert).

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export type SplitMode = 'split' | 'rotation';

export interface RotationMember {
  id: string;
  name: string;
  /** Position chosen by the family, from 0. null: never ordered, goes last. */
  rotationOrder: number | null;
  /** Out of the split and of the rotation, e.g. pays the health plan instead. */
  splitExcluded: boolean;
  createdAt: Date;
}

/** "2026-11" plus n months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Months from a to b ("2026-11" to "2027-01" is 2). */
export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number) as [number, number];
  const [by, bm] = b.split('-').map(Number) as [number, number];
  return by * 12 + bm - (ay * 12 + am);
}

/** "2026-11" to "novembro". */
export function monthName(month: string): string {
  return MONTH_NAMES[Number(month.split('-')[1]) - 1] ?? month;
}

/** Caregivers who take part in the split or rotation, in the family's order (then sign-up order). */
export function rotationParticipants<T extends RotationMember>(caregivers: T[]): T[] {
  return caregivers
    .filter((c) => !c.splitExcluded)
    .sort(
      (a, b) =>
        (a.rotationOrder ?? Number.MAX_SAFE_INTEGER) - (b.rotationOrder ?? Number.MAX_SAFE_INTEGER) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
}

/**
 * Who buys in each month from `from`, `count` months. The first participant buys in `startMonth`,
 * the second in the next month, and so on, starting over at the end of the list.
 */
export function rotationSchedule<T>(
  participants: T[],
  startMonth: string,
  from: string,
  count: number,
): { month: string; member: T }[] {
  if (participants.length === 0) return [];
  const n = participants.length;
  return Array.from({ length: count }, (_, i) => {
    const month = addMonths(from, i);
    const index = ((monthsBetween(startMonth, month) % n) + n) % n;
    return { month, member: participants[index]! };
  });
}

/** Text of the monthly alert: whose turn it is now and who comes next. */
export function rotationTurnText(input: {
  month: string;
  payer: string;
  next: string | null;
  patient: string;
}): { title: string; body: string } {
  const month = monthName(input.month);
  const nextMonth = monthName(addMonths(input.month, 1));
  const next =
    input.next && input.next !== input.payer ? ` Em ${nextMonth}, a vez é de ${input.next}.` : '';
  return {
    title: `Em ${month}, ${input.payer} compra os remédios`,
    body: `É a vez de ${input.payer} comprar os remédios de ${input.patient} este mês. Quando comprar, marque "Já comprei" no app.${next}`,
  };
}

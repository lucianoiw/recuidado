export interface StockStatus {
  /** Pills left: counted minus the doses confirmed since. Never below 0. */
  units: number;
  /** Whole days of doses left, or null for a medicine without times. */
  daysLeft: number | null;
  /** Few days left: the family should get more. */
  low: boolean;
}

/**
 * How long the pills at home last, at one pill per dose time. Only confirmed
 * doses are counted: for the others we do not know if she took them.
 */
export function stockStatus(input: {
  counted: number;
  takenSince: number;
  dosesPerDay: number;
  lowDays: number;
}): StockStatus {
  const units = Math.max(0, input.counted - input.takenSince);
  if (input.dosesPerDay <= 0) return { units, daysLeft: null, low: units === 0 };
  const daysLeft = Math.floor(units / input.dosesPerDay);
  return { units, daysLeft, low: daysLeft <= input.lowDays };
}

/** "Restam 6 comprimidos, dá para 3 dias." */
export function lowStockText(s: StockStatus): string {
  if (s.units === 0) return 'Pelas doses confirmadas, os comprimidos acabaram.';
  const pills = s.units === 1 ? 'Resta 1 comprimido' : `Restam ${s.units} comprimidos`;
  if (s.daysLeft === null) return `${pills}.`;
  if (s.daysLeft === 0) return `${pills}, não dá para o dia todo.`;
  return `${pills}, dá para ${s.daysLeft === 1 ? '1 dia' : `${s.daysLeft} dias`}.`;
}

import type { Stock } from "./api";

/** "dá para 3 dias", "dá para 1 dia", "não dá para o dia todo". */
export function daysText(days: number): string {
  if (days === 0) return "não dá para o dia todo";
  return `dá para ${days === 1 ? "1 dia" : `${days} dias`}`;
}

/** "12 comprimidos, dá para 6 dias" or "Acabou, pelas doses confirmadas". */
export function stockText(s: Stock): string {
  if (s.units === 0) return "Acabou, pelas doses confirmadas";
  const pills = s.units === 1 ? "1 comprimido" : `${s.units} comprimidos`;
  return s.daysLeft === null ? pills : `${pills}, ${daysText(s.daysLeft)}`;
}

/** Digits typed in the pills field to a count; "" is null, anything else invalid is undefined. */
export function parseUnits(raw: string): number | null | undefined {
  const t = raw.trim();
  if (t === "") return null;
  if (!/^\d{1,4}$/.test(t)) return undefined;
  const n = Number(t);
  return n <= 1000 ? n : undefined;
}

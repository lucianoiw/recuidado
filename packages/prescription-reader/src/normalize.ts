import { DEFAULT_ROUTINE, INTERVAL_TIMES, TIMES_PER_DAY } from "./routine.ts";
import type { PrescriptionItem, PrescriptionReading, ScheduledDose, Strength } from "./schema.ts";

/** Salt and form words removed to build a join key against public drug lists. */
const SALT_PATTERNS: RegExp[] = [
  /\b(di)?cloridrato de\b/g,
  /\bbromidrato de\b/g,
  /\b(hemi)?fumarato de\b/g,
  /\b(besilato|maleato|mesilato|succinato|sulfato|citrato|tartarato|acetato|valerato|propionato) de\b/g,
  /\b(potassic|sodic|calcic|magnesic)[oa]\b/g,
  /\b(mono|di|tri|sesqui)?h?idratad[oa]\b/g,
];

/** Lowercase, strip accents, collapse spaces. */
export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "Cloridrato de Metformina" -> "metformina"; "Losartana Potássica" -> "losartana". */
export function normalizeIngredient(activeIngredient: string): string {
  let folded = foldText(activeIngredient);
  for (const pattern of SALT_PATTERNS) folded = folded.replace(pattern, " ");
  return folded.replace(/\s+/g, " ").trim();
}

function formatStrength(strength: Strength): string | null {
  if (strength.value === null || strength.unit === null || strength.unit === "other") return null;
  return `${Number(strength.value.toFixed(4))} ${strength.unit.toLowerCase()}`;
}

/**
 * Join key for Farmácia Popular / CMED lookups, e.g. "losartana 50 mg".
 * Null when the active ingredient is unknown.
 */
export function toMatchKey(item: Pick<PrescriptionItem, "active_ingredient" | "strength">): string | null {
  if (!item.active_ingredient) return null;
  const ingredient = normalizeIngredient(item.active_ingredient);
  if (!ingredient) return null;
  const strength = formatStrength(item.strength);
  return strength ? `${ingredient} ${strength}` : ingredient;
}

/** Accepts "8:00", "08h", "8h30", "08:00" and returns "HH:MM", or null if invalid. */
export function normalizeTime(raw: string): string | null {
  const match = raw.trim().toLowerCase().match(/^(\d{1,2})(?:[:h](\d{2})?)?h?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Times used when the model returned no schedule for a scheduled item. */
export function defaultTimes(frequency: PrescriptionItem["frequency"]): string[] {
  if (frequency.as_needed) return [];
  if (frequency.interval_hours !== null && INTERVAL_TIMES[frequency.interval_hours]) {
    return INTERVAL_TIMES[frequency.interval_hours]!;
  }
  if (frequency.times_per_day !== null && TIMES_PER_DAY[frequency.times_per_day]) {
    return TIMES_PER_DAY[frequency.times_per_day]!;
  }
  return [];
}

const COUNTABLE_UNITS = new Set(["tablet", "capsule"]);

/** Tablets or capsules needed for 30 days (or the written duration). Null when not countable. */
export function monthlyUnits(item: PrescriptionItem): number | null {
  if (!item.dose_unit || !COUNTABLE_UNITS.has(item.dose_unit)) return null;
  if (item.frequency.as_needed || item.schedule.length === 0) return null;
  const perDay = item.schedule.reduce((sum, dose) => sum + (dose.amount ?? item.dose_per_intake ?? 0), 0);
  if (perDay === 0) return null;
  const days = item.duration.days !== null ? Math.min(item.duration.days, 30) : 30;
  return Math.ceil(perDay * days);
}

export interface NormalizedItem extends PrescriptionItem {
  /** Join key for Farmácia Popular / CMED, e.g. "losartana 50 mg". */
  match_key: string | null;
  /** Units for 30 days of treatment, used to price the month. */
  monthly_units: number | null;
}

export interface NormalizedReading extends Omit<PrescriptionReading, "items"> {
  items: NormalizedItem[];
}

function sortByTime(schedule: ScheduledDose[]): ScheduledDose[] {
  return [...schedule].sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Deterministic clean-up after the model: fixes time formats, fills missing
 * schedules from the routine table, adds match_key and monthly_units.
 * It never changes a drug, strength or amount.
 */
export function normalizeReading(reading: PrescriptionReading): NormalizedReading {
  const warnings = [...reading.warnings];

  const items = reading.items.map((original): NormalizedItem => {
    const item: PrescriptionItem = structuredClone(original);
    const reviewReasons: string[] = item.review_reason ? [item.review_reason] : [];

    const validSchedule: ScheduledDose[] = [];
    for (const dose of item.schedule) {
      const time = normalizeTime(dose.time) ?? (dose.anchor !== "fixed_time" ? DEFAULT_ROUTINE[dose.anchor] : null);
      if (time) validSchedule.push({ ...dose, time });
      else reviewReasons.push(`Horário inválido descartado: "${dose.time}".`);
    }
    item.schedule = sortByTime(validSchedule);

    if (item.schedule.length === 0 && !item.frequency.as_needed) {
      const times = defaultTimes(item.frequency);
      if (times.length > 0) {
        item.schedule = sortByTime(
          times.map((time) => ({ time, amount: item.dose_per_intake, anchor: "fixed_time" as const })),
        );
        item.schedule_source = "inferred";
      } else {
        reviewReasons.push("Não foi possível definir os horários a partir da posologia.");
      }
    }
    if (item.schedule.length === 0) item.schedule_source = "none";

    if (!item.active_ingredient) reviewReasons.push("Princípio ativo não identificado.");

    if (reviewReasons.length > 0) {
      item.needs_review = true;
      item.review_reason = [...new Set(reviewReasons)].join(" ");
    }

    return { ...item, match_key: toMatchKey(item), monthly_units: monthlyUnits(item) };
  });

  if (items.some((item) => item.needs_review) && warnings.length === 0) {
    warnings.push("Alguns itens precisam de conferência da família antes de criar os lembretes.");
  }

  return { ...reading, items, warnings };
}

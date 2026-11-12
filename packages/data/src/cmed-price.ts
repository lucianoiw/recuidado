/**
 * Reference price of a medicine from the CMED list (seed/cmed-pmc.csv.gz):
 * the maximum consumer price (PMC) in the demo state, per pill, for the
 * presentations that match the active ingredient(s) and strength.
 *
 * The PMC is a legal ceiling: a pharmacy may sell for less, never for more.
 * The monthly reference uses the cheapest presentation on the list, so the
 * savings the app shows are a conservative number.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readCsv } from "./lib/csv.ts";
import { looseMatchKey, parseStrengths } from "./lib/normalize.ts";
import { SEED_DIR } from "./lib/paths.ts";
import { expandGroupedStrengths } from "./medicine-search.ts";

/** Days in the monthly reference, as the screens say "por mês". */
export const DAYS_PER_MONTH = 30;

export interface CmedOffer {
  product: string;
  presentation: string;
  laboratory: string;
  productType: string;
  unitsPerPack: number;
  /** PMC of the pack in the demo state, in cents. */
  packCents: number;
  /** packCents / unitsPerPack. Fractional cents are kept until the monthly total is rounded. */
  perUnitCents: number;
  /** Prescription stripe printed on the box; null when the list does not say. */
  stripe: "red" | "black" | "none" | null;
}

export interface CmedPrice {
  /** Cheapest per pill (usually a generic or a similar). */
  cheapest: CmedOffer;
  /** Most expensive per pill (usually the reference brand). */
  priciest: CmedOffer;
  /** How many presentations matched. */
  presentations: number;
  /** Cheapest offer times the pills of a month. Null when there are no fixed times. */
  monthlyCents: number | null;
  /** Same for the most expensive offer. */
  monthlyMaxCents: number | null;
  /** Publication date of the CMED list, e.g. "2026-11-09". */
  listDate: string | null;
  /** Some matched presentation is sold as a generic (product type "Genérico"). */
  hasGeneric: boolean;
  /** Strictest stripe among the matched presentations (black over red over none). */
  stripe: "red" | "black" | "none" | null;
}

/** Bigger packs are hospital or institutional sizes. */
const MAX_RETAIL_UNITS = 120;

let index: Map<string, CmedOffer[]> | null = null;
let listDate: string | null = null;

function cents(value: string | undefined): number | null {
  const number = Number(value);
  return value && Number.isFinite(number) && number > 0 ? Math.round(number * 100) : null;
}

function load(path = join(SEED_DIR, "cmed-pmc.csv.gz")): Map<string, CmedOffer[]> {
  if (index) return index;
  const byKey = new Map<string, CmedOffer[]>();
  for (const row of readCsv(path)) {
    const unitsPerPack = Number(row.units_per_pack);
    const packCents = cents(row.pmc_region);
    // Packs measured in ml or g can not be counted per dose.
    if (!Number.isInteger(unitsPerPack) || unitsPerPack <= 0 || packCents === null) continue;
    const ingredients = (row.substance ?? "").split(";").map((part) => part.trim()).filter(Boolean);
    const strengths = parseStrengths(expandGroupedStrengths(row.presentation ?? ""));
    if (ingredients.length === 0 || strengths.length === 0) continue;
    const key = looseMatchKey(ingredients, strengths.slice(0, ingredients.length));
    if (!key) continue;
    const offer: CmedOffer = {
      product: row.product ?? "",
      presentation: row.presentation ?? "",
      laboratory: row.laboratory ?? "",
      productType: row.product_type ?? "",
      unitsPerPack,
      packCents,
      perUnitCents: packCents / unitsPerPack,
      stripe: row.stripe === "red" || row.stripe === "black" || row.stripe === "none" ? row.stripe : null,
    };
    const list = byKey.get(key);
    if (list) list.push(offer);
    else byKey.set(key, [offer]);
  }
  index = byKey;
  return byKey;
}

function loadListDate(): string | null {
  if (listDate !== null) return listDate;
  try {
    const meta = JSON.parse(readFileSync(join(SEED_DIR, "cmed-pmc.meta.json"), "utf8")) as { source?: { published_on?: string } };
    listDate = meta.source?.published_on ?? "";
  } catch {
    listDate = "";
  }
  return listDate || null;
}

/**
 * CMED reference price for a medicine as the family wrote it, e.g.
 * ("Losartana potássica", "50 mg", 2 doses a day). Null when the list has no
 * countable presentation with that ingredient and strength.
 */
export function findCmedPrice(
  activeIngredient: string,
  strength: string | null | undefined,
  dosesPerDay: number,
): CmedPrice | null {
  const ingredients = activeIngredient.split("+").map((part) => part.trim()).filter(Boolean);
  const strengths = parseStrengths(strength ?? "");
  if (ingredients.length === 0 || strengths.length === 0) return null;
  const offers = load().get(looseMatchKey(ingredients, strengths) ?? "");
  if (!offers || offers.length === 0) return null;
  // Hospital-size packs (x 500) are not what a family buys; use them only when nothing else exists.
  const retail = offers.filter((offer) => offer.unitsPerPack <= MAX_RETAIL_UNITS);
  const sorted = [...(retail.length > 0 ? retail : offers)].sort((a, b) => a.perUnitCents - b.perUnitCents || a.packCents - b.packCents);
  const cheapest = sorted[0]!;
  const priciest = sorted.at(-1)!;
  const units = dosesPerDay > 0 ? dosesPerDay * DAYS_PER_MONTH : 0;
  return {
    cheapest,
    priciest,
    presentations: sorted.length,
    monthlyCents: units > 0 ? Math.round(cheapest.perUnitCents * units) : null,
    monthlyMaxCents: units > 0 ? Math.round(priciest.perUnitCents * units) : null,
    listDate: loadListDate(),
    hasGeneric: sorted.some((offer) => offer.productType.startsWith("Genérico")),
    stripe: strictestStripe(sorted.map((offer) => offer.stripe)),
  };
}

const STRIPE_ORDER = ["black", "red", "none"] as const;

function strictestStripe(stripes: CmedOffer["stripe"][]): CmedPrice["stripe"] {
  return STRIPE_ORDER.find((stripe) => stripes.includes(stripe)) ?? null;
}

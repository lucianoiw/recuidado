/**
 * Runtime lookup over seed/free-access.csv: where a medicine is free.
 * Used by the API to add freeAt / highCost to each medication.
 */
import { join } from "node:path";
import { readCsv } from "./lib/csv.ts";
import { looseKey, looseMatchKey, parseStrengths } from "./lib/normalize.ts";
import { SEED_DIR } from "./lib/paths.ts";

export type FreePlace = "farmacia_popular" | "ubs";

export interface FreeAccess {
  /** Where it is free with a plain prescription. Empty when nowhere. */
  freeAt: FreePlace[];
  /** In the CEAF ("Farmácia de Alto Custo") list: free with the LME form, never automatic. */
  highCost: boolean;
}

interface Index {
  byMatch: Map<string, Record<string, string>>;
  ceafDrugs: Set<string>;
}

let index: Index | null = null;

function isHighCost(row: Record<string, string>): boolean {
  return row.ceaf_sp ? row.ceaf_sp === "true" : row.ceaf === "true";
}

function load(path = join(SEED_DIR, "free-access.csv")): Index {
  if (index) return index;
  const rows = readCsv(path);
  index = {
    byMatch: new Map(rows.map((row) => [row.loose_match_key!, row])),
    // Prefer the São Paulo state list when the seed has it.
    ceafDrugs: new Set(rows.filter((row) => isHighCost(row)).map((row) => row.loose_key!)),
  };
  return index;
}

/**
 * Looks up a medicine by its active ingredient(s) and strength as written,
 * e.g. ("Losartana Potássica", "50 mg") or ("levodopa + benserazida", "200 mg + 50 mg").
 * Without a strength, only the CEAF flag can be answered.
 */
export function findFreeAccess(activeIngredient: string, strength: string | null | undefined): FreeAccess {
  const { byMatch, ceafDrugs } = load();
  const ingredients = activeIngredient.split("+").map((part) => part.trim()).filter(Boolean);
  const strengths = parseStrengths(strength ?? "");
  const loose = looseKey(ingredients);
  const row = strengths.length > 0 ? byMatch.get(looseMatchKey(ingredients, strengths) ?? "") : undefined;
  const freeAt: FreePlace[] = [];
  if (row?.farmacia_popular === "true") freeAt.push("farmacia_popular");
  if (row?.ubs === "true") freeAt.push("ubs");
  const highCost = row ? isHighCost(row) : loose !== null && ceafDrugs.has(loose);
  return { freeAt, highCost };
}

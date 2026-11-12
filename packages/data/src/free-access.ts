/**
 * Runtime lookup over seed/free-access.csv: where a medicine is free.
 * Used by the API to add freeAt / highCost to each medication.
 */
import { readFileSync } from "node:fs";
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
  /** Extra rule of the Farmácia Popular for this item (age, diagnosis), in pt-BR. Null when none. */
  farmaciaPopularRule: string | null;
}

/**
 * Farmácia Popular items with an extra rule. Dapagliflozina: the official list gives it for
 * "diabetes mellitus + doença cardiovascular"; SES-MG states the 65+ age limit
 * (saude.mg.gov.br/wp-content/uploads/2025/05/DIABETES-MELLITUS-TIPO-2-07.05.25.pdf).
 */
const FARMACIA_POPULAR_RULES: Record<string, string> = {
  dapagliflozina: "No Farmácia Popular, só para 65 anos ou mais com diabetes tipo 2 e doença cardiovascular.",
};

/** "XR", "LP", "liberação prolongada"...: a different product from the plain tablet. */
const EXTENDED_RELEASE =
  /\b(xr|xl|lp|sr|cr|od|retard|a[cç][aã]o prolongada|libera[cç][aã]o (prolongada|controlada|modificada|estendida|lenta))\b/i;

export function isExtendedRelease(text: string): boolean {
  return EXTENDED_RELEASE.test(text);
}

interface Index {
  byMatch: Map<string, Record<string, string>>;
  ceafDrugs: Set<string>;
  /** loose_match_key of items each list also gives in extended release. */
  extended: Record<FreePlace, Set<string>>;
}

let index: Index | null = null;

function isHighCost(row: Record<string, string>): boolean {
  return row.ceaf_sp ? row.ceaf_sp === "true" : row.ceaf === "true";
}

interface ListItem {
  name: string;
  active_ingredients: string[];
  strengths: { value: number; unit: string }[];
}

function extendedKeys(file: string): Set<string> {
  const { items } = JSON.parse(readFileSync(join(SEED_DIR, file), "utf8")) as { items: ListItem[] };
  const keys = items
    .filter((item) => isExtendedRelease(item.name))
    .map((item) =>
      looseMatchKey(
        item.active_ingredients,
        item.strengths,
      ),
    );
  return new Set(keys.filter((key): key is string => Boolean(key)));
}

function load(path = join(SEED_DIR, "free-access.csv")): Index {
  if (index) return index;
  const rows = readCsv(path);
  index = {
    byMatch: new Map(rows.map((row) => [row.loose_match_key!, row])),
    // Prefer the São Paulo state list when the seed has it.
    ceafDrugs: new Set(rows.filter((row) => isHighCost(row)).map((row) => row.loose_key!)),
    extended: {
      farmacia_popular: extendedKeys("pfpb-free-items.json"),
      ubs: extendedKeys("remume-sp.json"),
    },
  };
  return index;
}

function lookup(ingredients: string[], strength: string | null | undefined) {
  const { byMatch, ceafDrugs } = load();
  const strengths = parseStrengths(strength ?? "");
  const loose = looseKey(ingredients);
  const matchKey = strengths.length > 0 ? looseMatchKey(ingredients, strengths) : null;
  const row = matchKey ? byMatch.get(matchKey) : undefined;
  const highCost = row ? isHighCost(row) : loose !== null && ceafDrugs.has(loose);
  return { row, matchKey, loose, highCost };
}

/**
 * Looks up a medicine by its active ingredient(s) and strength as written,
 * e.g. ("Losartana Potássica", "50 mg") or ("levodopa + benserazida", "200 mg + 50 mg").
 * `name` is the name on the prescription ("Metformina XR"): an extended-release product is
 * only free where that list has the extended-release item.
 * Without a strength, only the CEAF flag can be answered.
 */
export function findFreeAccess(
  activeIngredient: string,
  strength: string | null | undefined,
  name?: string | null,
): FreeAccess {
  const { extended } = load();
  const ingredients = activeIngredient.split("+").map((part) => part.trim()).filter(Boolean);
  let found = lookup(ingredients, strength);
  // Combos are listed both ways: "sacubitril + valsartana" and "sacubitril valsartana sódica".
  if (!found.row && !found.highCost && ingredients.length > 1) {
    const joined = lookup([ingredients.join(" ")], strength);
    if (joined.row || joined.highCost) found = joined;
  }
  const { row, matchKey, loose } = found;
  const xr = isExtendedRelease(`${name ?? ""} ${activeIngredient} ${strength ?? ""}`);
  const listed = (place: FreePlace) => !xr || (matchKey !== null && extended[place].has(matchKey));
  const freeAt: FreePlace[] = [];
  if (row?.farmacia_popular === "true" && listed("farmacia_popular")) freeAt.push("farmacia_popular");
  if (row?.ubs === "true" && listed("ubs")) freeAt.push("ubs");
  const rule = freeAt.includes("farmacia_popular") && loose ? FARMACIA_POPULAR_RULES[loose] ?? null : null;
  return { freeAt, highCost: found.highCost, farmaciaPopularRule: rule };
}

/**
 * Where each medicine is free: Farmácia Popular, any UBS (REMUME), a UBS
 * reference service, or the Farmácia de Alto Custo (CEAF).
 *
 * The three lists write names in different styles ("dipropionato de
 * beclometasona" and "beclometasona, dipropionato"), so they are joined on
 * loose_match_key (salt-free, order-free, with strengths). A prescription item
 * is looked up with looseMatchKey(ingredients, strengths) from this package.
 *
 * Input: seed/pfpb-free-items.json, seed/remume-sp.json, seed/ceaf.json
 * Output: seed/free-access.csv
 */
import { readFileSync } from "node:fs";
import { writeCsv } from "./lib/csv.ts";
import { looseKey, looseMatchKey } from "./lib/normalize.ts";
import { seedPath } from "./lib/paths.ts";
import type { CeafItem } from "./fetch-ceaf.ts";
import type { FreeItem } from "./fetch-free-items.ts";
import type { RemumeItem } from "./fetch-remume.ts";

export interface FreeAccessRow {
  loose_match_key: string;
  loose_key: string;
  /** One readable name, from the first list that has the item. */
  name: string;
  farmacia_popular: boolean;
  /** Any UBS of São Paulo hands it out (REMUME access "ubs"). */
  ubs: boolean;
  /** Only UBS reference services, for patients treated there (REMUME access "restricted"). */
  ubs_restricted: boolean;
  /** In the CEAF list in this strength: free at the Farmácia de Alto Custo with an approved LME. */
  ceaf: boolean;
  /** CEAF group (1A, 1B, 2) when ceaf is true. */
  ceaf_group: string | null;
  /** The drug is in the CEAF list in some strength (useful when the strength did not match). */
  ceaf_drug: boolean;
  /** Exact match keys of the source rows, joined by " | ". */
  match_keys: string;
}

export function linkFreeAccess(free: FreeItem[], remume: RemumeItem[], ceaf: CeafItem[]): FreeAccessRow[] {
  const rows = new Map<string, FreeAccessRow>();
  const ceafDrugs = new Set(ceaf.map((item) => item.loose_key).filter(Boolean));
  const row = (looseMatch: string | null, loose: string | null, name: string, matchKey: string | null) => {
    if (!looseMatch || !loose) return null;
    let current = rows.get(looseMatch);
    if (!current) {
      current = {
        loose_match_key: looseMatch,
        loose_key: loose,
        name,
        farmacia_popular: false,
        ubs: false,
        ubs_restricted: false,
        ceaf: false,
        ceaf_group: null,
        ceaf_drug: ceafDrugs.has(loose),
        match_keys: "",
      };
      rows.set(looseMatch, current);
    }
    if (matchKey) {
      const keys = new Set(current.match_keys ? current.match_keys.split(" | ") : []);
      keys.add(matchKey);
      current.match_keys = [...keys].join(" | ");
    }
    return current;
  };
  for (const item of free) {
    const current = row(looseMatchKey(item.active_ingredients, item.strengths), looseKey(item.active_ingredients), item.name, item.match_key);
    if (current) current.farmacia_popular = true;
  }
  for (const item of remume) {
    const current = row(item.loose_match_key, looseKey(item.active_ingredients), item.name, item.match_key);
    if (!current) continue;
    if (item.access === "ubs") current.ubs = true;
    else current.ubs_restricted = true;
  }
  for (const item of ceaf) {
    const current = row(item.loose_match_key, item.loose_key, `${item.ingredient} ${item.presentation}`, item.match_key);
    if (!current) continue;
    current.ceaf = true;
    current.ceaf_group ??= item.group;
  }
  return [...rows.values()].sort((a, b) => a.loose_match_key.localeCompare(b.loose_match_key));
}

async function main(): Promise<void> {
  const read = <T>(name: string) => JSON.parse(readFileSync(seedPath(name), "utf8")) as { items: T[] };
  const rows = linkFreeAccess(
    read<FreeItem>("pfpb-free-items.json").items,
    read<RemumeItem>("remume-sp.json").items,
    read<CeafItem>("ceaf.json").items,
  );
  writeCsv(seedPath("free-access.csv"), rows as unknown as Record<string, unknown>[], [
    "loose_match_key", "loose_key", "name", "farmacia_popular", "ubs", "ubs_restricted",
    "ceaf", "ceaf_group", "ceaf_drug", "match_keys",
  ]);
  const count = (predicate: (row: FreeAccessRow) => boolean) => rows.filter(predicate).length;
  console.log(
    `Free access: ${rows.length} presentations. Farmácia Popular ${count((r) => r.farmacia_popular)}, ` +
      `UBS ${count((r) => r.ubs)}, both ${count((r) => r.farmacia_popular && r.ubs)}, CEAF ${count((r) => r.ceaf)}.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

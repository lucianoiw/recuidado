/**
 * Reference price of each free Farmácia Popular item, from CMED.
 *
 * Joins seed/pfpb-free-items.json with seed/cmed-pmc.csv.gz by barcode (EAN),
 * which is exact. Items whose EANs are not in CMED fall back to match_key.
 * The result is what a family would pay at most (PMC) if it bought the item
 * instead of getting it for free: the base of the "economia" number.
 *
 * Output: seed/pfpb-free-item-prices.csv
 */
import { readFileSync } from "node:fs";
import { readCsv, writeCsv } from "./lib/csv.ts";
import { seedPath } from "./lib/paths.ts";
import type { FreeItem } from "./fetch-free-items.ts";

export interface FreeItemPrice {
  item_id: string;
  match_key: string | null;
  indication: string;
  matched_by: "ean" | "match_key" | "none";
  cmed_presentations: number;
  pmc_region_min: number | null;
  pmc_region_median: number | null;
  pmc_region_max: number | null;
  per_unit_median: number | null;
  cheapest_presentation: string | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  return Number(value.toFixed(4));
}

export function linkPrices(items: FreeItem[], cmed: Record<string, string>[]): FreeItemPrice[] {
  const byEan = new Map<string, Record<string, string>[]>();
  const byKey = new Map<string, Record<string, string>[]>();
  for (const row of cmed) {
    for (const ean of [row.ean, row.ean_2, row.ean_3]) {
      if (ean) byEan.set(ean, [...(byEan.get(ean) ?? []), row]);
    }
    if (row.match_key) byKey.set(row.match_key, [...(byKey.get(row.match_key) ?? []), row]);
  }
  return items.map((item) => {
    const eans = item.variants.flatMap((variant) => variant.eans);
    let rows = [...new Set(eans.flatMap((ean) => byEan.get(ean) ?? []))];
    let matchedBy: FreeItemPrice["matched_by"] = rows.length > 0 ? "ean" : "none";
    if (rows.length === 0 && item.match_key) {
      rows = byKey.get(item.match_key) ?? [];
      if (rows.length > 0) matchedBy = "match_key";
    }
    const priced = rows.filter((row) => row.pmc_region !== "");
    const prices = priced.map((row) => Number(row.pmc_region));
    const perUnit = priced.filter((row) => row.pmc_region_per_unit !== "").map((row) => Number(row.pmc_region_per_unit));
    const cheapest = [...priced].sort((a, b) => Number(a.pmc_region) - Number(b.pmc_region))[0];
    return {
      item_id: item.id,
      match_key: item.match_key,
      indication: item.indication,
      matched_by: matchedBy,
      cmed_presentations: priced.length,
      pmc_region_min: prices.length ? Math.min(...prices) : null,
      pmc_region_median: median(prices),
      pmc_region_max: prices.length ? Math.max(...prices) : null,
      per_unit_median: median(perUnit),
      cheapest_presentation: cheapest ? `${cheapest.product} ${cheapest.presentation}` : null,
    };
  });
}

async function main(): Promise<void> {
  const { items } = JSON.parse(readFileSync(seedPath("pfpb-free-items.json"), "utf8")) as { items: FreeItem[] };
  const cmed = readCsv(seedPath("cmed-pmc.csv.gz"));
  const prices = linkPrices(items, cmed);
  writeCsv(seedPath("pfpb-free-item-prices.csv"), prices, [
    "item_id", "match_key", "indication", "matched_by", "cmed_presentations",
    "pmc_region_min", "pmc_region_median", "pmc_region_max", "per_unit_median", "cheapest_presentation",
  ]);
  const unmatched = prices.filter((price) => price.matched_by === "none").map((price) => price.item_id);
  console.log(`Linked ${prices.length - unmatched.length}/${prices.length} free items to CMED.`);
  if (unmatched.length > 0) console.log(`Without CMED price: ${unmatched.join(", ")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

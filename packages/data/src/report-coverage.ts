/**
 * Coverage map: for every medicine sold in Brazil (CMED price list), where it is free.
 * Answers "and if it is another medicine?": each active ingredient and strength on sale
 * is looked up in the programs (Farmácia Popular, UBS of São Paulo, Alto Custo SP).
 *
 * Input: seed/cmed-pmc.csv.gz, seed/programs/*.json
 * Output: seed/coverage.json (totals and the list of free / Alto Custo medicines)
 */
import { join } from "node:path";
import { readCsv, writeJson } from "./lib/csv.ts";
import { foldText } from "./lib/normalize.ts";
import { SEED_DIR } from "./lib/paths.ts";
import { expandGroupedStrengths, presentationStrength } from "./medicine-search.ts";
import { seedProgramIndex, type ProgramIndex } from "./programs.ts";

export type CoverageBucket = "free_plain" | "free_restricted" | "high_cost" | "buy";

export interface CoverageEntry {
  activeIngredient: string;
  strengths: number;
  /** Strengths free with a plain prescription, by place. */
  farmaciaPopular: string[];
  ubs: string[];
  /** Strengths the UBS gives only at some units. */
  ubsRestricted: string[];
  highCost: boolean;
  bucket: CoverageBucket;
}

const cap = (text: string) => {
  const clean = text.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};

export function buildCoverage(rows: Iterable<Record<string, string>>, index: ProgramIndex = seedProgramIndex()): CoverageEntry[] {
  const byActive = new Map<string, { activeIngredient: string; strengths: Set<string> }>();
  for (const row of rows) {
    const ingredients = (row.substance ?? "").split(";").map(cap).filter(Boolean);
    if (ingredients.length === 0) continue;
    const activeIngredient = ingredients.join(" + ");
    const key = foldText(activeIngredient);
    let entry = byActive.get(key);
    if (!entry) byActive.set(key, (entry = { activeIngredient, strengths: new Set() }));
    const strength = presentationStrength(expandGroupedStrengths(row.presentation ?? ""));
    if (strength) entry.strengths.add(strength);
  }

  const out: CoverageEntry[] = [];
  for (const { activeIngredient, strengths } of byActive.values()) {
    const fp: string[] = [];
    const ubs: string[] = [];
    const restricted: string[] = [];
    let highCost = false;
    for (const strength of strengths) {
      const access = index.find(activeIngredient, strength);
      if (access.freeAt.includes("farmacia_popular")) fp.push(strength);
      if (access.freeAt.includes("ubs")) ubs.push(strength);
      if (access.ubsRestricted) restricted.push(strength);
      if (access.highCost) highCost = true;
    }
    const bucket: CoverageBucket =
      fp.length + ubs.length > 0 ? "free_plain" : restricted.length > 0 ? "free_restricted" : highCost ? "high_cost" : "buy";
    out.push({ activeIngredient, strengths: strengths.size, farmaciaPopular: fp, ubs, ubsRestricted: restricted, highCost, bucket });
  }
  return out.sort((a, b) => a.activeIngredient.localeCompare(b.activeIngredient));
}

export function summarize(entries: CoverageEntry[]) {
  const count = (bucket: CoverageBucket) => entries.filter((entry) => entry.bucket === bucket).length;
  return {
    activeIngredients: entries.length,
    freePlain: count("free_plain"),
    freeRestricted: count("free_restricted"),
    highCostOnly: count("high_cost"),
    buy: count("buy"),
    atFarmaciaPopular: entries.filter((entry) => entry.farmaciaPopular.length > 0).length,
    atUbs: entries.filter((entry) => entry.ubs.length > 0).length,
    highCostAny: entries.filter((entry) => entry.highCost).length,
  };
}

async function main(): Promise<void> {
  const entries = buildCoverage(readCsv(join(SEED_DIR, "cmed-pmc.csv.gz")));
  const totals = summarize(entries);
  writeJson(join(SEED_DIR, "coverage.json"), {
    source: { cmed: "seed/cmed-pmc.csv.gz", programs: "seed/programs/*.json", built_at: new Date().toISOString().slice(0, 10) },
    totals,
    // "buy" entries are left out: everything not listed is bought at the pharmacy.
    free: entries.filter((entry) => entry.bucket !== "buy"),
  });
  console.log(totals);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

/**
 * Public entry of @recuidado/data: paths of the seed files and their row types,
 * so the API seed can import them without knowing how they were built.
 */
import { join } from "node:path";
import { SEED_DIR } from "./lib/paths.ts";

export type { FreeItem } from "./fetch-free-items.ts";
export type { CmedRow } from "./fetch-cmed.ts";
export type { Pharmacy } from "./fetch-pharmacies.ts";
export type { FreeItemPrice } from "./link-free-items-prices.ts";
export { readCsv } from "./lib/csv.ts";
export { buildIngredientKey, buildMatchKey, normalizeIngredient, parseStrengths } from "./lib/normalize.ts";
export { DEMO_REGION } from "./region.ts";
export { SOURCES } from "./sources.ts";

export const SEED_FILES = {
  freeItems: join(SEED_DIR, "pfpb-free-items.json"),
  freeItemEans: join(SEED_DIR, "pfpb-free-eans.csv"),
  freeItemPrices: join(SEED_DIR, "pfpb-free-item-prices.csv"),
  cmed: join(SEED_DIR, "cmed-pmc.csv.gz"),
  cmedMeta: join(SEED_DIR, "cmed-pmc.meta.json"),
  pharmacies: join(SEED_DIR, "pharmacies.json"),
} as const;

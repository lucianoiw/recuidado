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
export type { RemumeItem } from "./fetch-remume.ts";
export type { CeafItem } from "./fetch-ceaf.ts";
export type { SusUnit } from "./fetch-sus-units.ts";
export type { FreeAccessRow } from "./link-free-access.ts";
export { readCsv } from "./lib/csv.ts";
export { findFreeAccess, type FreeAccess, type FreePlace } from "./free-access.ts";
export { highCostGuide, slugFor, type HighCostGuide, type HighCostItem } from "./high-cost-guide.ts";
export { findCmedPrice, DAYS_PER_MONTH, type CmedOffer, type CmedPrice } from "./cmed-price.ts";
export { presentationForm, searchMedicines, type MedicineKind, type MedicineResult, type MedicineStrength } from "./medicine-search.ts";
export { buildIngredientKey, buildMatchKey, looseKey, looseMatchKey, normalizeIngredient, parseStrengths } from "./lib/normalize.ts";
export { DEMO_REGION } from "./region.ts";
export { SOURCES } from "./sources.ts";

export const SEED_FILES = {
  freeItems: join(SEED_DIR, "pfpb-free-items.json"),
  freeItemEans: join(SEED_DIR, "pfpb-free-eans.csv"),
  freeItemPrices: join(SEED_DIR, "pfpb-free-item-prices.csv"),
  cmed: join(SEED_DIR, "cmed-pmc.csv.gz"),
  cmedMeta: join(SEED_DIR, "cmed-pmc.meta.json"),
  pharmacies: join(SEED_DIR, "pharmacies.json"),
  remume: join(SEED_DIR, "remume-sp.json"),
  ceaf: join(SEED_DIR, "ceaf.json"),
  susUnits: join(SEED_DIR, "sus-units.json"),
  freeAccess: join(SEED_DIR, "free-access.csv"),
  ceafSpGuides: join(SEED_DIR, "ceaf-sp-guides.json"),
} as const;

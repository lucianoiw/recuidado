/**
 * CMED price list (Anvisa).
 *
 * Source: "Lista de preços de medicamentos - Preços Fábrica e Máximos ao
 * Consumidor" (xlsx), published monthly by the CMED executive secretariat.
 * The PMC (Preço Máximo ao Consumidor) is the legal ceiling a pharmacy may
 * charge. We keep the columns Recuidado needs and compute the PMC for the demo
 * state (see icmsRateFor in region.ts).
 *
 * Output: seed/cmed-pmc.csv.gz (gzipped CSV, one row per presentation that has a PMC)
 */
import ExcelJS from "exceljs";
import { writeCsv, writeJson } from "./lib/csv.ts";
import { absoluteUrl, downloadFile, fetchText } from "./lib/http.ts";
import {
  buildIngredientKey,
  buildMatchKey,
  parseBrazilianNumber,
  parseStrengths,
  parseUnitsPerPack,
} from "./lib/normalize.ts";
import { cachePath, seedPath } from "./lib/paths.ts";
import { DEMO_REGION, icmsRateFor } from "./region.ts";
import { SOURCES } from "./sources.ts";

export interface CmedFile {
  url: string;
  /** "20261109" taken from the file name. */
  publishedOn: string;
}

/** Finds the PMC list link ("lista_pmc_<yyyymmdd>_...xlsx") on the CMED page. */
export async function findLatestCmedList(): Promise<CmedFile> {
  const html = await fetchText(SOURCES.cmedPricesPage);
  const links = [...html.matchAll(/href="([^"]*lista_pmc_(\d{8})_[^"]*\.xlsx[^"]*)"/gi)].map((match) => ({
    url: absoluteUrl(match[1]!, SOURCES.cmedPricesPage),
    publishedOn: match[2]!,
  }));
  links.sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
  if (!links[0]) throw new Error("No PMC list found on the CMED page.");
  return links[0];
}

export interface CmedRow {
  ggrem: string;
  registry: string;
  ean: string | null;
  ean_2: string | null;
  ean_3: string | null;
  substance: string;
  product: string;
  presentation: string;
  laboratory: string;
  therapeutic_class: string;
  product_type: string;
  price_regime: string;
  icms_zero: boolean;
  pmc_0: number | null;
  pmc_12: number | null;
  pmc_18: number | null;
  /** PMC for the demo state, after the ICMS rule. */
  pmc_region: number | null;
  icms_rate_region: number;
  units_per_pack: number | null;
  /** Prescription stripe on the box: red, black (controlled, the pharmacy keeps the prescription) or none. */
  stripe: "red" | "black" | "none" | null;
  pmc_region_per_unit: number | null;
  match_key: string | null;
  ingredient_key: string | null;
}

const COLUMNS = {
  substance: "SUBSTÂNCIA",
  laboratory: "LABORATÓRIO",
  ggrem: "CÓDIGO GGREM",
  registry: "REGISTRO",
  ean1: "EAN 1",
  ean2: "EAN 2",
  ean3: "EAN 3",
  product: "PRODUTO",
  presentation: "APRESENTAÇÃO",
  therapeuticClass: "CLASSE TERAPÊUTICA",
  productType: "TIPO DE PRODUTO (STATUS DO PRODUTO)",
  priceRegime: "REGIME DE PREÇO",
  pmc0: "PMC 0 %",
  pmc12: "PMC 12 %",
  pmc18: "PMC 18 %",
  hospitalOnly: "RESTRIÇÃO HOSPITALAR",
  icmsZero: "ICMS 0%",
  stripe: "TARJA",
} as const;

/** "Tarja Vermelha", "Tarja Vermelha(*)", "Tarja Preta", "Venda Livre", "- (*)". */
export function parseStripe(raw: string): CmedRow["stripe"] {
  const text = raw.toLowerCase();
  if (text.includes("preta")) return "black";
  if (text.includes("vermelha")) return "red";
  if (text.includes("livre") || text.startsWith("-")) return "none";
  return null;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "richText" in value) return value.richText.map((part) => part.text).join("");
  return String(value).trim();
}

function cleanEan(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/** Streams the "Lista PMC" sheet and returns one clean row per presentation sold at retail. */
export async function parseCmedWorkbook(path: string): Promise<CmedRow[]> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(path, { sharedStrings: "cache", worksheets: "emit" });
  const rows: CmedRow[] = [];
  for await (const sheet of reader) {
    // The workbook has a "Cabeçalho" sheet with notes and then "Lista PMC".
    let index: Record<string, number> | null = null;
    for await (const row of sheet) {
      const values = Array.from(row.values as ExcelJS.CellValue[], cellText);
      if (!index) {
        if (values.includes(COLUMNS.ggrem) && values.includes(COLUMNS.pmc18)) {
          index = Object.fromEntries(values.map((name, position) => [name, position]));
        }
        continue;
      }
      const get = (name: string): string => values[index![name] ?? -1] ?? "";
      if (get(COLUMNS.hospitalOnly).toLowerCase() === "sim") continue;
      const pmc0 = parseBrazilianNumber(get(COLUMNS.pmc0));
      const pmc12 = parseBrazilianNumber(get(COLUMNS.pmc12));
      const pmc18 = parseBrazilianNumber(get(COLUMNS.pmc18));
      if (pmc0 === null && pmc12 === null && pmc18 === null) continue;

      const productType = get(COLUMNS.productType);
      const icmsZero = get(COLUMNS.icmsZero).toLowerCase() === "sim";
      const rate = icmsRateFor(productType, icmsZero);
      const pmcRegion = rate === 0 ? pmc0 : rate === 12 ? pmc12 : pmc18;
      const presentation = get(COLUMNS.presentation);
      const substance = get(COLUMNS.substance);
      const ingredients = substance.split(";").map((part) => part.trim()).filter(Boolean);
      const units = parseUnitsPerPack(presentation);

      rows.push({
        ggrem: get(COLUMNS.ggrem),
        registry: get(COLUMNS.registry),
        ean: cleanEan(get(COLUMNS.ean1)),
        ean_2: cleanEan(get(COLUMNS.ean2)),
        ean_3: cleanEan(get(COLUMNS.ean3)),
        substance,
        product: get(COLUMNS.product),
        presentation,
        laboratory: get(COLUMNS.laboratory),
        therapeutic_class: get(COLUMNS.therapeuticClass),
        product_type: productType,
        price_regime: get(COLUMNS.priceRegime),
        icms_zero: icmsZero,
        pmc_0: pmc0,
        pmc_12: pmc12,
        pmc_18: pmc18,
        pmc_region: pmcRegion,
        icms_rate_region: rate,
        units_per_pack: units,
        stripe: parseStripe(get(COLUMNS.stripe)),
        pmc_region_per_unit: pmcRegion !== null && units ? Number((pmcRegion / units).toFixed(4)) : null,
        match_key: buildMatchKey(ingredients, parseStrengths(presentation)),
        ingredient_key: buildIngredientKey(ingredients),
      });
    }
    if (index) break;
  }
  return rows;
}

export const CMED_CSV_COLUMNS: (keyof CmedRow)[] = [
  "ggrem", "registry", "ean", "ean_2", "ean_3", "substance", "product", "presentation", "laboratory",
  "therapeutic_class", "product_type", "price_regime", "icms_zero", "pmc_0", "pmc_12", "pmc_18",
  "pmc_region", "icms_rate_region", "units_per_pack", "pmc_region_per_unit", "match_key", "ingredient_key",
  "stripe",
];

async function main(): Promise<void> {
  const file = await findLatestCmedList();
  const local = await downloadFile(file.url, cachePath(`cmed-pmc-${file.publishedOn}.xlsx`));
  const rows = await parseCmedWorkbook(local);
  writeCsv(seedPath("cmed-pmc.csv.gz"), rows, CMED_CSV_COLUMNS);
  const published = `${file.publishedOn.slice(0, 4)}-${file.publishedOn.slice(4, 6)}-${file.publishedOn.slice(6, 8)}`;
  writeJson(seedPath("cmed-pmc.meta.json"), {
    source: {
      name: "Anvisa, CMED, Lista de preços de medicamentos (Preço Fábrica e Preço Máximo ao Consumidor)",
      page: SOURCES.cmedPricesPage,
      url: file.url,
      published_on: published,
      fetched_at: new Date().toISOString(),
    },
    region: { state: DEMO_REGION.state, icms_rule: "18% (0% when CMED marks ICMS 0%, 12% for generics)" },
    rows: rows.length,
    excluded: "hospital-only presentations and rows without PMC",
  });
  console.log(`CMED ${published}: ${rows.length} presentations with PMC.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

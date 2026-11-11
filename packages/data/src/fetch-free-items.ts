/**
 * Farmácia Popular free items.
 *
 * Source: the monthly "Lista de Medicamentos" PDF with the barcode (EAN) of
 * every product the program dispenses for free, published by the Ministério
 * da Saúde. One row per EAN; we group rows into items (drug + strength) and
 * keep the EANs so CMED prices can be joined by barcode.
 *
 * Output: seed/pfpb-free-items.json and seed/pfpb-free-eans.csv
 */
import { readFileSync } from "node:fs";
import { getDocumentProxy } from "unpdf";
import { writeCsv, writeJson } from "./lib/csv.ts";
import { absoluteUrl, downloadFile, fetchText } from "./lib/http.ts";
import { buildIngredientKey, buildMatchKey, foldText, parseStrengths, type Strength } from "./lib/normalize.ts";
import { cachePath, seedPath } from "./lib/paths.ts";
import { SOURCES } from "./sources.ts";

const MONTHS = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export interface FreeItemListFile {
  url: string;
  year: number;
  month: number;
}

/** Finds the newest "lista-de-medicamentos-ean-<month>-<year>.pdf" on the barcode page. */
export async function findLatestFreeItemList(today = new Date()): Promise<FreeItemListFile> {
  for (const year of [today.getFullYear(), today.getFullYear() - 1]) {
    const pageUrl = SOURCES.pfpbBarcodesPage(year);
    let html: string;
    try {
      html = await fetchText(pageUrl);
    } catch {
      continue;
    }
    const files: FreeItemListFile[] = [];
    for (const match of html.matchAll(/href="([^"]*lista-de-medicamentos-ean-([a-zç]+)-(\d{4})\.pdf)(?:\/view)?"/gi)) {
      const month = MONTHS.indexOf(foldText(match[2]!)) + 1;
      if (month === 0) continue;
      const url = absoluteUrl(match[1]!, pageUrl);
      files.push({ url: `${url}/@@download/file`, year: Number(match[3]), month });
    }
    files.sort((a, b) => b.year - a.year || b.month - a.month);
    if (files[0]) return files[0];
  }
  throw new Error("No Farmácia Popular barcode list found on the official page.");
}

export interface BarcodeRow {
  product: string;
  indication: string;
  ean: string;
}

interface TextItem {
  x: number;
  y: number;
  text: string;
}

// Column boundaries of the PDF table, in PDF points (page width 595).
const INDICATION_MIN_X = 340;
const BARCODE_MIN_X = 470;
const SAME_ROW_TOLERANCE = 5;

/**
 * Reads the barcode table. Each EAN anchors a row; the product and the
 * indication are the texts on the same line. Long indications wrap into two
 * lines around the EAN, so every indication text within the tolerance is joined.
 */
export async function parseBarcodePdf(data: Uint8Array): Promise<BarcodeRow[]> {
  const pdf = await getDocumentProxy(data);
  const rows: BarcodeRow[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    const items: TextItem[] = [];
    for (const raw of content.items) {
      if (!("str" in raw) || !raw.str.trim()) continue;
      items.push({ x: raw.transform[4] as number, y: raw.transform[5] as number, text: raw.str.trim() });
    }
    for (const anchor of items) {
      if (anchor.x < BARCODE_MIN_X || !/^\d{8,14}$/.test(anchor.text)) continue;
      const near = items.filter((item) => Math.abs(item.y - anchor.y) <= SAME_ROW_TOLERANCE);
      const product = near
        .filter((item) => item.x < INDICATION_MIN_X)
        .sort((a, b) => Math.abs(a.y - anchor.y) - Math.abs(b.y - anchor.y))[0];
      const indication = near
        .filter((item) => item.x >= INDICATION_MIN_X && item.x < BARCODE_MIN_X)
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((item) => item.text)
        .join(" ");
      if (!product) throw new Error(`EAN ${anchor.text} on page ${pageNumber} has no product next to it.`);
      rows.push({ product: product.text.replace(/\s+/g, " "), indication: indication.replace(/\s+/g, " "), ean: anchor.text });
    }
  }
  return rows;
}

export interface FreeItem {
  /** Stable slug, e.g. "losartana-50-mg". */
  id: string;
  /** Indication as written by the Ministério, e.g. "HIPERTENSÃO". */
  indication: string;
  /** Product name as written in the list, without the pack detail. */
  name: string;
  active_ingredients: string[];
  strengths: Strength[];
  /** Join key shared with prescription-reader, e.g. "losartana 50 mg". */
  match_key: string | null;
  /** Strength-free key, e.g. "losartana". */
  ingredient_key: string | null;
  /** Pack or form detail written after " - ", e.g. "AÇÃO PROLONGADA", "3 CARTELAS COM 21 COMPRIMIDOS". */
  variants: { detail: string | null; eans: string[] }[];
  ean_count: number;
}

/** "CARBIDOPA 25MG + LEVODOPA 250MG" -> ["carbidopa", "levodopa"]. Text before the first digit of each part. */
export function splitIngredients(name: string): string[] {
  return name
    .split("+")
    .map((part) => part.replace(/\d.*$/, "").trim().toLowerCase())
    .filter(Boolean);
}

function slugify(text: string): string {
  return foldText(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function groupFreeItems(rows: BarcodeRow[]): FreeItem[] {
  const items = new Map<string, FreeItem>();
  for (const row of rows) {
    const [name, ...rest] = row.product.split(" - ");
    const detail = rest.length > 0 ? rest.join(" - ").trim() : null;
    const ingredients = splitIngredients(name!);
    const strengths = parseStrengths(name!);
    const matchKey = buildMatchKey(ingredients, strengths);
    // "AÇÃO PROLONGADA" is a different drug form, so it is its own item; pack sizes are variants.
    const formDetail = detail && !/\d/.test(detail) ? detail : null;
    const id = slugify([matchKey ?? name, formDetail].filter(Boolean).join(" "));
    let item = items.get(id);
    if (!item) {
      item = {
        id,
        indication: row.indication,
        name: [name!.trim(), formDetail].filter(Boolean).join(" - "),
        active_ingredients: ingredients,
        strengths,
        match_key: matchKey,
        ingredient_key: buildIngredientKey(ingredients),
        variants: [],
        ean_count: 0,
      };
      items.set(id, item);
    }
    const variantDetail = formDetail ? null : detail;
    let variant = item.variants.find((v) => v.detail === variantDetail);
    if (!variant) {
      variant = { detail: variantDetail, eans: [] };
      item.variants.push(variant);
    }
    if (!variant.eans.includes(row.ean)) {
      variant.eans.push(row.ean);
      item.ean_count++;
    }
  }
  return [...items.values()].sort((a, b) => a.indication.localeCompare(b.indication) || a.id.localeCompare(b.id));
}

async function main(): Promise<void> {
  const file = await findLatestFreeItemList();
  const local = await downloadFile(file.url, cachePath(`pfpb-ean-${file.year}-${String(file.month).padStart(2, "0")}.pdf`));
  const rows = await parseBarcodePdf(new Uint8Array(readFileSync(local)));
  const items = groupFreeItems(rows);

  writeJson(seedPath("pfpb-free-items.json"), {
    source: {
      name: "Ministério da Saúde, Programa Farmácia Popular do Brasil, Lista de Medicamentos (códigos de barras)",
      url: file.url,
      reference_month: `${file.year}-${String(file.month).padStart(2, "0")}`,
      official_list: SOURCES.pfpbItemsPdf,
      fetched_at: new Date().toISOString(),
    },
    items,
  });
  writeCsv(
    seedPath("pfpb-free-eans.csv"),
    rows.map((row) => {
      const item = items.find((i) => i.variants.some((v) => v.eans.includes(row.ean)))!;
      return { ean: row.ean, item_id: item.id, match_key: item.match_key, product: row.product, indication: row.indication };
    }),
    ["ean", "item_id", "match_key", "product", "indication"],
  );
  console.log(`Farmácia Popular ${file.year}-${file.month}: ${rows.length} EANs, ${items.length} items.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

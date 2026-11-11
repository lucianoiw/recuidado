/**
 * REMUME: medicines the São Paulo municipal network hands out for free.
 *
 * Source: the "Itens entregues à população" PDF linked from the REMUME page of
 * the Secretaria Municipal de Saúde. Each row has the medicine (DCB name,
 * strength and form) and where it is available. Most items are available in
 * every UBS ("Unidades de Saúde"); others only in reference services (IST/AIDS,
 * ophthalmology, TB) for patients treated there.
 *
 * Output: seed/remume-sp.json
 */
import { readFileSync } from "node:fs";
import { getDocumentProxy } from "unpdf";
import { writeJson } from "./lib/csv.ts";
import { absoluteUrl, downloadFile, fetchText } from "./lib/http.ts";
import { buildIngredientKey, buildMatchKey, foldText, looseMatchKey, parseStrengths, type Strength } from "./lib/normalize.ts";
import { cachePath, seedPath } from "./lib/paths.ts";
import { SOURCES } from "./sources.ts";

export interface RemumeRow {
  /** Medicine as written, e.g. "anlodipino, besilato 5 mg comprimido". */
  medicine: string;
  /** Availability and conditions as written, e.g. "medicamento disponível nas Unidades de Saúde". */
  availability: string;
}

export interface RemumeItem {
  /** Stable slug, e.g. "anlodipino-5-mg-comprimido". */
  id: string;
  name: string;
  active_ingredients: string[];
  strengths: Strength[];
  /** Join key shared with prescription-reader, e.g. "anlodipino 5 mg". */
  match_key: string | null;
  ingredient_key: string | null;
  /** Salt-free, order-free key with strengths, to join with lists written in other styles. */
  loose_match_key: string | null;
  /** "ubs": any UBS hands it out. "restricted": only reference services, for their own patients. */
  access: "ubs" | "restricted";
  availability: string;
}

/** Finds the newest "remume_site_*" PDF on the REMUME page. */
export async function findRemumePdf(): Promise<string> {
  const html = await fetchText(SOURCES.remumePage);
  const match = html.match(/href="([^"]*remume_site[^"]*)"/i);
  if (!match) throw new Error("REMUME PDF link not found on the official page.");
  return absoluteUrl(match[1]!.replace(/&amp;/g, "&"), SOURCES.remumePage);
}

// Column boundary of the PDF table, in PDF points (page width 595).
const AVAILABILITY_MIN_X = 300;
// Page header (logo, title, column names) and footer (page number, version).
const HEADER_MIN_Y = 778;
const FIRST_PAGE_HEADER_MIN_Y = 640;
const FOOTER_MAX_Y = 55;

interface Line {
  y: number;
  left: string;
  right: string;
}

/**
 * Reads the REMUME table. A row starts on the line where the availability
 * column begins with "medicamento"; the following lines, until the next row,
 * continue the medicine name (left) or the conditions (right).
 */
export async function parseRemumePdf(data: Uint8Array): Promise<RemumeRow[]> {
  const pdf = await getDocumentProxy(data);
  const rows: RemumeRow[] = [];
  let current: RemumeRow | null = null;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    const byY = new Map<number, { x: number; text: string }[]>();
    const headerMinY = pageNumber === 1 ? FIRST_PAGE_HEADER_MIN_Y : HEADER_MIN_Y;
    for (const raw of content.items) {
      if (!("str" in raw) || !raw.str.trim()) continue;
      const y = Math.round(raw.transform[5] as number);
      if (y >= headerMinY || y <= FOOTER_MAX_Y) continue;
      const list = byY.get(y) ?? [];
      list.push({ x: raw.transform[4] as number, text: raw.str.trim() });
      byY.set(y, list);
    }
    const lines: Line[] = [...byY.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([y, items]) => {
        items.sort((a, b) => a.x - b.x);
        const join = (list: typeof items) => list.map((item) => item.text).join(" ").replace(/\s+/g, " ").trim();
        return {
          y,
          left: join(items.filter((item) => item.x < AVAILABILITY_MIN_X)),
          right: join(items.filter((item) => item.x >= AVAILABILITY_MIN_X)),
        };
      });
    for (const line of lines) {
      // Alphabet section letters ("A") and the "TOPO" link are navigation, not data.
      if (/^[A-Z]$/.test(line.left) && !line.right) continue;
      if (line.right === "TOPO" && !line.left) continue;
      if (line.left && /^(medicamento|dispon[ií]vel)\b/i.test(line.right)) {
        current = { medicine: line.left, availability: line.right };
        rows.push(current);
        continue;
      }
      if (!current) continue;
      if (line.left) current.medicine = `${current.medicine} ${line.left}`.trim();
      if (line.right) current.availability = `${current.availability} ${line.right}`.trim();
    }
  }
  return rows;
}

/** "anlodipino, besilato 5 mg" -> "anlodipino"; "abacavir, sulfato (ABC) 300 mg" -> "abacavir". */
export function remumeIngredients(medicine: string): string[] {
  return medicine
    .split("+")
    .map((part) =>
      part
        .replace(/\d.*$/, "")
        .replace(/\(.*?\)/g, " ")
        .split(",")[0]!
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
}

/** Available in any UBS when the text names "Unidades de Saúde" and no exclusive condition. */
export function remumeAccess(availability: string): RemumeItem["access"] {
  const folded = foldText(availability);
  return /disponivel nas unidades de saude/.test(folded) && !/exclusiv/.test(folded) ? "ubs" : "restricted";
}

function slugify(text: string): string {
  return foldText(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function toRemumeItems(rows: RemumeRow[]): RemumeItem[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const ingredients = remumeIngredients(row.medicine);
    const strengths = parseStrengths(row.medicine);
    let id = slugify(row.medicine);
    for (let n = 2; seen.has(id); n++) id = `${slugify(row.medicine)}-${n}`;
    seen.add(id);
    return {
      id,
      name: row.medicine,
      active_ingredients: ingredients,
      strengths,
      match_key: buildMatchKey(ingredients, strengths),
      ingredient_key: buildIngredientKey(ingredients),
      loose_match_key: looseMatchKey(ingredients, strengths),
      access: remumeAccess(row.availability),
      availability: row.availability,
    };
  });
}

async function main(): Promise<void> {
  const url = await findRemumePdf();
  const local = await downloadFile(url, cachePath("remume-sp.pdf"));
  const rows = await parseRemumePdf(new Uint8Array(readFileSync(local)));
  const items = toRemumeItems(rows);
  writeJson(seedPath("remume-sp.json"), {
    source: {
      name: "Prefeitura de São Paulo, Secretaria Municipal da Saúde, REMUME (itens entregues à população)",
      url,
      page: SOURCES.remumePage,
      fetched_at: new Date().toISOString(),
    },
    items,
  });
  const ubs = items.filter((item) => item.access === "ubs").length;
  console.log(`REMUME SP: ${items.length} items, ${ubs} available in any UBS.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

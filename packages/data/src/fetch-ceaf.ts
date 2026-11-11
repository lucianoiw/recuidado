/**
 * CEAF ("Farmácia de Alto Custo"): medicines of the Componente Especializado.
 *
 * The SUS gives them for free at the state pharmacy, but only with the LME
 * form filled by the doctor and within a clinical protocol (PCDT). The app only
 * flags them; it does not run that process.
 *
 * Source: REMEME, the full state list of Espírito Santo, which tags each row
 * with its component. Rows tagged "Especializado - Grupo 1A/1B/2 (CEAF/RENAME)"
 * are the national CEAF list (groups 1 and 2 are defined by the Ministério da
 * Saúde for every state). See SOURCES.ceafListPdf for why it is not the São
 * Paulo list.
 *
 * The PDF draws the drug name once, vertically centred over all its
 * presentations, on a coloured band that covers them; rows are assigned to
 * names through those bands (see pageBands).
 *
 * Output: seed/ceaf.json
 */
import { readFileSync } from "node:fs";
import { getDocumentProxy, getResolvedPDFJS } from "unpdf";
import { writeJson } from "./lib/csv.ts";
import { downloadFile } from "./lib/http.ts";
import { buildIngredientKey, buildMatchKey, foldText, looseKey, looseMatchKey, parseStrengths, type Strength } from "./lib/normalize.ts";
import { cachePath, seedPath } from "./lib/paths.ts";
import { SOURCES } from "./sources.ts";

interface TextItem {
  x: number;
  y: number;
  text: string;
}

export interface PdfRow {
  y: number;
  top: number;
  bottom: number;
  presentation: string;
  component: string;
}

export interface NameLabel {
  y: number;
  text: string;
}

export interface CeafRow {
  ingredient: string;
  presentation: string;
  /** "1A", "1B" or "2". */
  group: string;
}

// Column boundaries in PDF points (landscape page, width 842).
const NAME_MAX_X = 105;
const PRESENTATION_MAX_X = 212;
const COMPONENT_MAX_X = 320;
const RESPONSIBILITY_MIN_X = 740;
const TABLE_TOP_Y = 490;
const NAME_LINE_GAP = 12;

const join = (items: TextItem[]) =>
  items
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((item) => item.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

/** Rows of one page, anchored on the "responsibility" column (UNIÃO, ESTADO, MUNICÍPIO). */
export function pageRows(items: TextItem[]): PdfRow[] {
  const anchors = items
    .filter((item) => item.x >= RESPONSIBILITY_MIN_X && item.y < TABLE_TOP_Y && /^(UNIÃO|ESTADO|MUNICÍPIO)/i.test(item.text))
    .sort((a, b) => b.y - a.y);
  const lowest = Math.min(...items.filter((item) => item.y < TABLE_TOP_Y).map((item) => item.y));
  return anchors.map((anchor, index) => {
    const previous = anchors[index - 1];
    const next = anchors[index + 1];
    const top = previous ? (previous.y + anchor.y) / 2 : TABLE_TOP_Y;
    const bottom = next ? (anchor.y + next.y) / 2 : Math.min(anchor.y, lowest) - 6;
    const inside = items.filter((item) => item.y <= top && item.y > bottom);
    return {
      y: anchor.y,
      top,
      bottom,
      presentation: join(inside.filter((item) => item.x >= NAME_MAX_X && item.x < PRESENTATION_MAX_X)),
      component: join(inside.filter((item) => item.x >= PRESENTATION_MAX_X && item.x < COMPONENT_MAX_X)),
    };
  });
}

/** Drug names of one page; a name wrapped in two lines becomes one label at its middle. */
export function pageNames(items: TextItem[]): NameLabel[] {
  const lines = items.filter((item) => item.x < NAME_MAX_X && item.y < TABLE_TOP_Y).sort((a, b) => b.y - a.y);
  const labels: { items: TextItem[] }[] = [];
  for (const line of lines) {
    const last = labels.at(-1);
    // "de pilocarpina)" continues the name above even after a wider gap.
    const continues = /^(de |\))/i.test(line.text);
    if (last && (last.items.at(-1)!.y - line.y <= NAME_LINE_GAP || continues)) last.items.push(line);
    else labels.push({ items: [line] });
  }
  return labels.map((label) => ({
    y: (label.items[0]!.y + label.items.at(-1)!.y) / 2,
    text: join(label.items),
  }));
}

export interface Band {
  top: number;
  bottom: number;
}

/**
 * Every drug of the table sits on a full-width background band (the PDF
 * alternates blue, white and pink per drug). Returns the bands below the
 * header, in page coordinates, from the page's drawing operators.
 */
export async function pageBands(page: Awaited<ReturnType<Awaited<ReturnType<typeof getDocumentProxy>>["getPage"]>>): Promise<Band[]> {
  const { OPS } = await getResolvedPDFJS();
  const list = await page.getOperatorList();
  type Matrix = [number, number, number, number, number, number];
  let matrix: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  let fill = "#000000";
  const bands: Band[] = [];
  list.fnArray.forEach((fn, index) => {
    const args = list.argsArray[index];
    if (fn === OPS.save) stack.push(matrix);
    else if (fn === OPS.restore) matrix = stack.pop() ?? matrix;
    else if (fn === OPS.transform) {
      const [a, b, c, d, e, f] = args as Matrix;
      const [A, B, C, D, E, F] = matrix;
      matrix = [a * A + b * C, a * B + b * D, c * A + d * C, c * B + d * D, e * A + f * C + E, e * B + f * D + F];
    } else if (fn === OPS.setFillRGBColor) fill = String(args[0]);
    else if (fn === OPS.constructPath && fill.toLowerCase() !== "#000000") {
      const box = args[2] as Record<string, number> | undefined;
      if (!box) return;
      const [minX, minY, maxX, maxY] = [box[0]!, box[1]!, box[2]!, box[3]!];
      const width = (maxX - minX) * Math.abs(matrix[0]);
      if (width < 700) return; // only full-width bands
      const y1 = minY * matrix[3] + matrix[5];
      const y2 = maxY * matrix[3] + matrix[5];
      const top = Math.max(y1, y2);
      const bottom = Math.min(y1, y2);
      if (bottom < TABLE_TOP_Y - 2) bands.push({ top: Math.min(top, TABLE_TOP_Y), bottom });
    }
  });
  return bands.sort((a, b) => b.top - a.top);
}

/** Row owner when the drug started on the previous page (its name is there). */
export const PREVIOUS_PAGE = -1;
/** Row owner when the drug continues on the next page (its name is drawn there). */
export const NEXT_PAGE = -2;

/**
 * For each row, the index of its drug name: the name inside the same band.
 * A band without a name holds a drug cut by the page break: at the top of the
 * page it belongs to the previous page's last name, at the bottom to the next
 * page's first name.
 */
export function assignRows(rows: PdfRow[], names: NameLabel[], bands: Band[]): number[] {
  const tolerance = 8;
  return rows.map((row) => {
    const bandIndex = bands.findIndex((b) => row.y <= b.top + tolerance && row.y >= b.bottom - tolerance);
    const band = bands[bandIndex];
    if (!band) return PREVIOUS_PAGE;
    const inside = names
      .map((name, index) => ({ name, index }))
      .filter(({ name }) => name.y <= band.top && name.y >= band.bottom);
    if (inside.length === 0) return bandIndex === bands.length - 1 && bandIndex > 0 ? NEXT_PAGE : PREVIOUS_PAGE;
    return inside.sort((a, b) => Math.abs(a.name.y - row.y) - Math.abs(b.name.y - row.y))[0]!.index;
  });
}

export async function parseCeafPdf(data: Uint8Array): Promise<CeafRow[]> {
  const pdf = await getDocumentProxy(data);
  const result: CeafRow[] = [];
  let carry: string | null = null;
  let pending: { presentation: string; group: string }[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const raw of content.items) {
      if (!("str" in raw) || !raw.str.trim()) continue;
      items.push({ x: raw.transform[4] as number, y: raw.transform[5] as number, text: raw.str.trim() });
    }
    const rows = pageRows(items);
    const names = pageNames(items);
    const owner = assignRows(rows, names, await pageBands(page));
    if (pending.length > 0 && names[0]) {
      for (const row of pending) result.push({ ingredient: names[0].text, ...row });
      pending = [];
    }
    rows.forEach((row, index) => {
      const group = row.component.match(/Especializado\s*-\s*Grupo\s*(1A|1B|2)/i)?.[1]?.toUpperCase();
      if (!group) return;
      const who = owner[index]!;
      if (who === NEXT_PAGE) pending.push({ presentation: row.presentation, group });
      else if (who >= 0) result.push({ ingredient: names[who]!.text, presentation: row.presentation, group });
      else if (carry) result.push({ ingredient: carry, presentation: row.presentation, group });
    });
    if (names.length > 0) carry = names.at(-1)!.text;
  }
  return result;
}

export interface CeafItem {
  ingredient: string;
  active_ingredients: string[];
  presentation: string;
  group: string;
  strengths: Strength[];
  match_key: string | null;
  ingredient_key: string | null;
  /** Salt-free, order-free key used to join lists written in different styles. */
  loose_key: string | null;
  loose_match_key: string | null;
}

/** "abacavir (sulfato de abacavir)" -> "abacavir"; "betametasona (dipropionato) + ..." keeps each part. */
export function ceafIngredients(name: string): string[] {
  return name
    .replace(/\(.*?\)/g, " ")
    .replace(/\(.*$/, " ")
    // A name cut by the page break: "de pilocarpina)" is the end of "pilocarpina (cloridrato de pilocarpina)".
    .replace(/^de\s+(.*?)\)?$/i, "$1")
    .split("+")
    .map((part) => part.replace(/\s+/g, " ").trim().toLowerCase())
    .filter(Boolean);
}

export function toCeafItems(rows: CeafRow[]): CeafItem[] {
  const seen = new Set<string>();
  const items: CeafItem[] = [];
  for (const row of rows) {
    // Diet supplements, syringes and the page legend are not medicines a prescription names.
    if (/legenda|complemento alimentar|fenilceton|seringa|solucao salina/.test(foldText(row.ingredient))) continue;
    let ingredients = ceafIngredients(row.ingredient);
    // "insulina análoga de ação rápida" lists the actual insulin in the presentation: "insulina Lispro, 100 UI/mL".
    const insulin = foldText(row.presentation).match(/^insulina ([a-z]+)/);
    if (insulin && ingredients[0]?.startsWith("insulina")) ingredients = [`insulina ${insulin[1]}`];
    const strengths = parseStrengths(row.presentation);
    const key = foldText(`${row.ingredient}|${row.presentation}`);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      ingredient: row.ingredient,
      active_ingredients: ingredients,
      presentation: row.presentation,
      group: row.group,
      strengths,
      match_key: buildMatchKey(ingredients, strengths),
      ingredient_key: buildIngredientKey(ingredients),
      loose_key: looseKey(ingredients),
      loose_match_key: looseMatchKey(ingredients, strengths),
    });
  }
  return items.sort((a, b) => a.ingredient.localeCompare(b.ingredient, "pt-BR"));
}

async function main(): Promise<void> {
  const local = await downloadFile(SOURCES.ceafListPdf, cachePath("ceaf-rememe-es.pdf"), 24 * 30);
  const rows = await parseCeafPdf(new Uint8Array(readFileSync(local)));
  const items = toCeafItems(rows);
  writeJson(seedPath("ceaf.json"), {
    source: {
      name: "Componente Especializado da Assistência Farmacêutica (CEAF), grupos 1A, 1B e 2, a partir da REMEME da SESA/ES",
      url: SOURCES.ceafListPdf,
      about: SOURCES.ceafPage,
      fetched_at: new Date().toISOString(),
    },
    items,
  });
  console.log(`CEAF: ${items.length} presentations, ${new Set(items.map((i) => i.ingredient_key)).size} drugs.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

/**
 * Medicine autocomplete over the CMED price list (seed/cmed-pmc.csv.gz):
 * every medicine sold in Brazil with a regulated price, by brand name and by
 * active ingredient, with the strengths and forms on sale.
 * Used by the API (GET /medications/search?q=) while the family types a name.
 */
import { join } from "node:path";
import { readCsv } from "./lib/csv.ts";
import { foldText, formatStrength, parseStrengths } from "./lib/normalize.ts";
import { SEED_DIR } from "./lib/paths.ts";
import { findFreeAccess, type FreePlace } from "./free-access.ts";

export type MedicineKind = "generic" | "brand";

export interface MedicineStrength {
  /** As the family would write it, e.g. "50 mg" or "5 mg + 100 mg". */
  strength: string;
  /** Pharmaceutical form in plain Portuguese, e.g. "comprimido". Null when unknown. */
  form: string | null;
  freeAt: FreePlace[];
  highCost: boolean;
}

export interface MedicineResult {
  /** What the user sees first: "Losartana potássica" or "Lotar". */
  name: string;
  /** Active ingredient(s), "+" between them: "Besilato de anlodipino + Losartana potássica". */
  activeIngredient: string;
  kind: MedicineKind;
  /** First laboratory found for a brand. Null for a generic name (many labs). */
  laboratory: string | null;
  strengths: MedicineStrength[];
}

interface Entry {
  name: string;
  activeIngredient: string;
  kind: MedicineKind;
  laboratory: string | null;
  /** Folded words of name and active ingredient, for prefix matching. */
  nameWords: string[];
  ingredientWords: string[];
  presentations: number;
  strengths: Map<string, { strength: string; form: string | null }>;
}

/** Ordered: the first pattern that matches the presentation names the form. */
const FORMS: [RegExp, string][] = [
  [/\bCOM\b.*\bEFERV/, "comprimido efervescente"],
  [/\bCOM\b.*\bORODISP/, "comprimido orodispersível"],
  [/\bCOM\b.*\bMAST/, "comprimido mastigável"],
  [/\bCOM\b.*\bSUBL/, "comprimido sublingual"],
  [/\bCOM\b.*\bLIB (PROL|RETARD|CONTROL|MODIF)/, "comprimido de liberação prolongada"],
  [/\bCOM REV\b/, "comprimido revestido"],
  [/\bCOM\b/, "comprimido"],
  [/\bDRG\b/, "drágea"],
  [/\bCAP\b.*\bLIB (PROL|RETARD|CONTROL|MODIF)/, "cápsula de liberação prolongada"],
  [/\bCAP\b/, "cápsula"],
  [/\bSOL (GOT )?OFT\b|\bSUS OFT\b|\bCOLIR/, "colírio"],
  [/\bSOL GOT\b|\bSOL OR\b.*\bGOT\b/, "gotas"],
  [/\bSOL OR\b/, "solução oral"],
  [/\bSUS OR\b/, "suspensão oral"],
  [/\bXPE\b/, "xarope"],
  [/\b(SOL|SUS|EMU) INJ\b|\bPO (LIOF )?(P\/ )?(SOL|SUS) INJ\b/, "injetável"],
  [/\bSPR NAS\b|\bSOL NAS\b|\bNASAL\b/, "spray nasal"],
  [/\bAER\b|\bSOL AER\b|\bINAL\b|\bPO INAL\b/, "inalatório"],
  [/\bCREM\b/, "creme"],
  [/\bPOM\b/, "pomada"],
  [/\bGEL\b/, "gel"],
  [/\bADES\b/, "adesivo"],
  [/\bSUP\b/, "supositório"],
  [/\bGRAN\b/, "granulado"],
  [/\bPO\b|\bPÓ\b/, "pó"],
  [/\bLOC\b|\bEMU\b/, "loção"],
];

export function presentationForm(presentation: string): string | null {
  const upper = presentation.toUpperCase();
  return FORMS.find(([pattern]) => pattern.test(upper))?.[1] ?? null;
}

/** "(5 + 100) MG ..." -> "5 MG + 100 MG ...", so each number keeps its unit. */
export function expandGroupedStrengths(presentation: string): string {
  return presentation.replace(
    /\(\s*(\d+(?:[.,]\d+)?(?:\s*\+\s*\d+(?:[.,]\d+)?)+)\s*\)\s*([A-Za-zµμ%]+(?:\s*\/\s*[A-Za-z]+)?)/g,
    (_match, numbers: string, unit: string) =>
      numbers
        .split("+")
        .map((value) => `${value.trim()} ${unit}`)
        .join(" + "),
  );
}

/** Strength as shown to the user: "50 mg", "5 mg + 100 mg". Null when the presentation has none. */
export function presentationStrength(presentation: string): string | null {
  const strengths = parseStrengths(expandGroupedStrengths(presentation));
  // pt-BR decimal comma: "12,5 mg".
  return strengths.length > 0 ? strengths.map((s) => formatStrength(s).replace(".", ",")).join(" + ") : null;
}

/** "LOSARTANA POTÁSSICA" -> "Losartana potássica"; drops notes such as "(PORT. 344/98 LISTA C 1)". */
function sentenceCase(text: string): string {
  const clean = text.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function words(text: string): string[] {
  return foldText(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

let entries: Entry[] | null = null;

function addPresentation(entry: Entry, presentation: string): void {
  entry.presentations++;
  const strength = presentationStrength(presentation);
  if (!strength) return;
  const form = presentationForm(presentation);
  const key = `${strength}|${form ?? ""}`;
  if (!entry.strengths.has(key)) entry.strengths.set(key, { strength, form });
}

function load(path = join(SEED_DIR, "cmed-pmc.csv.gz")): Entry[] {
  if (entries) return entries;
  const byKey = new Map<string, Entry>();
  for (const row of readCsv(path)) {
    const ingredients = (row.substance ?? "")
      .split(";")
      .map(sentenceCase)
      .filter(Boolean);
    if (ingredients.length === 0) continue;
    const activeIngredient = ingredients.join(" + ");
    const ingredientWords = words(activeIngredient);
    const presentation = row.presentation ?? "";

    const genericKey = `g|${foldText(activeIngredient)}`;
    let generic = byKey.get(genericKey);
    if (!generic) {
      generic = {
        name: activeIngredient,
        activeIngredient,
        kind: "generic",
        laboratory: null,
        nameWords: ingredientWords,
        ingredientWords,
        presentations: 0,
        strengths: new Map(),
      };
      byKey.set(genericKey, generic);
    }
    addPresentation(generic, presentation);

    // A brand is a product whose name is not just its ingredients (generics carry the ingredient name).
    const product = sentenceCase(row.product ?? "");
    const productWords = words(product);
    const isIngredientName = productWords.every((word) => ingredientWords.includes(word) || word === "de");
    if (!product || row.product_type === "Genérico" || isIngredientName) continue;
    const brandKey = `b|${foldText(product)}|${foldText(activeIngredient)}`;
    let brand = byKey.get(brandKey);
    if (!brand) {
      brand = {
        name: product,
        activeIngredient,
        kind: "brand",
        laboratory: row.laboratory?.trim() || null,
        nameWords: productWords,
        ingredientWords,
        presentations: 0,
        strengths: new Map(),
      };
      byKey.set(brandKey, brand);
    }
    addPresentation(brand, presentation);
  }
  entries = [...byKey.values()];
  return entries;
}

/** Every query word must start a word of the name or of the active ingredient. */
function score(entry: Entry, tokens: string[]): number | null {
  if (tokens.length === 0) return null;
  const all = [...entry.nameWords, ...entry.ingredientWords];
  if (!tokens.every((token) => all.some((word) => word.startsWith(token)))) return null;
  let value = 0;
  if (entry.nameWords[0]?.startsWith(tokens[0]!)) value += 100;
  if (tokens.every((token) => entry.nameWords.some((word) => word.startsWith(token)))) value += 50;
  if (entry.kind === "generic") value += 20;
  // Single-ingredient medicines first when the user typed one name.
  if (entry.activeIngredient.includes("+")) value -= 10;
  return value + Math.min(entry.presentations, 50) / 10;
}

function strengthOrder(a: MedicineStrength, b: MedicineStrength): number {
  const first = (text: string) => Number.parseFloat(text.replace(",", ".")) || 0;
  return (a.form ?? "").localeCompare(b.form ?? "") || first(a.strength) - first(b.strength);
}

/**
 * Autocomplete: "losar" finds "Losartana potássica" and brands such as "Cozaar".
 * Queries under 2 letters return nothing.
 */
export function searchMedicines(query: string, limit = 10): MedicineResult[] {
  const all = words(query);
  // Numbers ("losartana 50") filter the strengths instead of the names.
  const tokens = all.filter((token) => !/^\d/.test(token));
  const numbers = all.filter((token) => /^\d/.test(token));
  if (tokens.join("").length < 2) return [];
  const matchesNumbers = (strength: string) =>
    numbers.every((number) => words(strength).some((word) => word.startsWith(number)));
  const ranked: { entry: Entry; value: number; strengths: { strength: string; form: string | null }[] }[] = [];
  for (const entry of load()) {
    const value = score(entry, tokens);
    if (value === null) continue;
    const strengths = [...entry.strengths.values()].filter(({ strength }) => matchesNumbers(strength));
    if (numbers.length > 0 && strengths.length === 0) continue;
    ranked.push({ entry, value, strengths });
  }
  ranked.sort((a, b) => b.value - a.value || a.entry.name.localeCompare(b.entry.name, "pt-BR"));
  return ranked.slice(0, Math.max(1, Math.min(limit, 50))).map(({ entry, strengths }) => ({
    name: entry.name,
    activeIngredient: entry.activeIngredient,
    kind: entry.kind,
    laboratory: entry.laboratory,
    strengths: strengths
      .map(({ strength, form }) => ({ strength, form, ...findFreeAccess(entry.activeIngredient, strength) }))
      .sort(strengthOrder),
  }));
}

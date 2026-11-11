/**
 * Text normalization shared by every dataset in this package.
 *
 * `normalizeIngredient` and the match key format mirror
 * packages/prescription-reader/src/normalize.ts so that a prescription item and
 * a row of the Farmácia Popular or CMED lists join on the same string, e.g.
 * "losartana 50 mg". Keep SALT_PATTERNS in sync with that file.
 */

/** Salt and form words removed to build a join key against public drug lists. */
const SALT_PATTERNS: RegExp[] = [
  /\b(di)?cloridrato de\b/g,
  /\bbromidrato de\b/g,
  /\b(hemi)?fumarato de\b/g,
  /\b(besilato|maleato|mesilato|succinato|sulfato|citrato|tartarato|acetato|valerato|propionato) de\b/g,
  /\b(potassic|sodic|calcic|magnesic)[oa]\b/g,
  /\b(mono|di|tri|sesqui)?h?idratad[oa]\b/g,
];

/** Lowercase, strip accents, collapse spaces. */
export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "Cloridrato de Metformina" -> "metformina"; "Losartana Potássica" -> "losartana". */
export function normalizeIngredient(activeIngredient: string): string {
  let folded = foldText(activeIngredient);
  for (const pattern of SALT_PATTERNS) folded = folded.replace(pattern, " ");
  return folded.replace(/\s+/g, " ").trim();
}

export interface Strength {
  value: number;
  /** Lowercase unit as written in the source, e.g. "mg", "mcg", "ui/ml", "mg/g". */
  unit: string;
}

const UNIT_ALIASES: Record<string, string> = { "µg": "mcg", "μg": "mcg", ug: "mcg", u: "ui", "u/ml": "ui/ml" };

// Number (with "," or "." decimals) followed by a unit and an optional "/denominator".
// A number right after "x" is a pack quantity ("X 40 G"), not a strength.
const STRENGTH_PATTERN =
  /(?<!\bx\s{0,3}|[\d.,])(\d+(?:[.,]\d+)?)\s*(mcg|µg|μg|ug|mg|g|ui|u|meq|%)(?:\s*\/\s*(ml|g|dose|jato|gota|actuacao|acionamento))?(?![a-z])/gi;

/** Every strength written in a text, in order: "10 MG/G + 0,443 MG/G CREM" -> [10 mg/g, 0.443 mg/g]. */
export function parseStrengths(text: string): Strength[] {
  const folded = foldText(text);
  const strengths: Strength[] = [];
  for (const match of folded.matchAll(STRENGTH_PATTERN)) {
    const value = Number(match[1]!.replace(",", "."));
    let unit = match[2]!.toLowerCase();
    if (match[3]) unit = `${unit}/${match[3].toLowerCase()}`;
    unit = UNIT_ALIASES[unit] ?? unit;
    if (Number.isFinite(value)) strengths.push({ value, unit });
  }
  return strengths;
}

export function formatStrength(strength: Strength): string {
  return `${Number(strength.value.toFixed(4))} ${strength.unit}`;
}

/**
 * Join key in the prescription-reader format: "losartana 50 mg".
 * Combinations pair each ingredient with its strength when the counts match:
 * "carbidopa 25 mg + levodopa 250 mg". Otherwise only the ingredients are used.
 */
export function buildMatchKey(ingredients: string[], strengths: Strength[]): string | null {
  const names = ingredients.map(normalizeIngredient).filter(Boolean);
  if (names.length === 0) return null;
  if (names.length === 1) return strengths[0] ? `${names[0]} ${formatStrength(strengths[0])}` : names[0]!;
  if (strengths.length === names.length) {
    return names.map((name, index) => `${name} ${formatStrength(strengths[index]!)}`).join(" + ");
  }
  return names.join(" + ");
}

/** Strength-free key, ingredients sorted: useful to list every presentation of a drug. */
export function buildIngredientKey(ingredients: string[]): string | null {
  const names = ingredients.map(normalizeIngredient).filter(Boolean).sort();
  return names.length > 0 ? names.join(" + ") : null;
}

/** "R$ 1.234,56", "1234,56", "54,23*" -> 1234.56. Empty or invalid -> null. */
export function parseBrazilianNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const text = String(raw).replace(/[R$\s*]/g, "");
  if (!text || text === "-") return null;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Countable units in a CMED presentation, or null when the pack is measured in
 * ml or g. "50 MG COM REV CT BL AL PLAS PVC/PVDC X 30" -> 30;
 * "CT 3 BL AL PLAS INC X 10" -> 30; "SOL OR CT FR VD AMB X 100 ML" -> null.
 */
export function parseUnitsPerPack(presentation: string): number | null {
  const folded = foldText(presentation);
  const matches = [...folded.matchAll(/\bx\s*(\d+)(?!\s*[.,]?\d)(\s*(ml|g|l|mg|doses?|cm|m)\b)?/g)];
  const last = matches.at(-1);
  if (!last || last[2]) return null;
  const perBlister = Number(last[1]);
  const blisters = folded.match(/\bct\s+(\d+)\s+(bl|str|env|cart)\b/);
  return blisters ? perBlister * Number(blisters[1]) : perBlister;
}

/**
 * Salt-free, order-free key to join lists written in different styles:
 * "dipropionato de beclometasona" and "beclometasona, dipropionato" both give
 * "beclometasona"; "levodopa + benserazida" gives "benserazida + levodopa".
 */
export function looseKey(ingredients: string[]): string | null {
  const names = ingredients
    .map((name) =>
      normalizeIngredient(name.split(",")[0]!)
        .replace(/\b[a-z]+(ato|eto|ito) de\b/g, " ")
        // "insulina análoga glargina" = "insulina glargina"; the Farmácia Popular writes NPH as "insulina humana".
        .replace(/\banaloga\b/g, " ")
        .replace(/\b(insulina humana) nph\b/g, "$1")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .sort();
  return names.length > 0 ? names.join(" + ") : null;
}

/** looseKey plus the strengths in order: "beclometasona 50 mcg", "benserazida + levodopa 50 mg + 200 mg". */
export function looseMatchKey(ingredients: string[], strengths: Strength[]): string | null {
  const key = looseKey(ingredients);
  if (!key) return null;
  if (strengths.length === 0) return key;
  // "100 mcg/dose" and "100 mcg" are the same inhaler strength.
  const format = (strength: Strength) => formatStrength(strength).replace(/\/(dose|jato|acionamento|actuacao)$/, "");
  if (ingredients.length === 1) return `${key} ${format(strengths[0]!)}`;
  const sorted = strengths.map(format).sort();
  return `${key} ${sorted.join(" + ")}`;
}

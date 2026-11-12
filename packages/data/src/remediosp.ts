/**
 * Reads the Remédio SP rows (seed/remediosp.json) per drug: the diseases (protocol names), the CID
 * codes and the age limits written in the notes. Only the CEAF rows: "PROTOCOLO ESTADUAL" holds
 * antibiotics and diets for specific protocols, which must not mark a common prescription as Alto Custo.
 */
import type { RemedioSpRow } from "./fetch-remediosp.ts";
import { foldText, looseKey, looseMatchKey, parseStrengths } from "./lib/normalize.ts";
import type { ProgramRule } from "./programs.ts";

/** "INSULINA ANALOGA DE ACAO RAPIDA - LISPRO" -> "insulina lispro"; drops "(BIOSSIMILAR)", "LAR", strengths. */
export function cleanActiveIngredient(name: string): string[] {
  const folded = foldText(name);
  const insulin = folded.match(/^insulina .* - ([a-z]+)$/);
  if (insulin) return [`insulina ${insulin[1]}`];
  return folded
    .replace(/\s*-?\s*\((biossimilar[^)]*|krohn|titulacao)\)/g, "")
    .replace(/\bdi- ?hidratado\b/g, "")
    .replace(/,.*$/, "")
    .replace(/\s\d.*$/, "")
    .replace(/\b(lar|de liberacao controlada)\b/g, "")
    .trim()
    .split(/\+|(?<=[a-z])-(?=[a-z])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Order-free word set, so "sacubitril valsartana sódica" and "sacubitril + valsartana" meet. */
export function drugWords(loose: string | null): string | null {
  if (!loose) return null;
  // "idursulfase alfa" is "idursulfase"; subtypes such as "1a" are not part of the drug.
  const words = loose.split(/[\s+]+/).filter((word) => word && word !== "alfa" && !/^\d/.test(word));
  return [...new Set(words)].sort().join(" ");
}

const years = (n: string) => `${Number(n)} ${Number(n) === 1 ? "ano" : "anos"}`;

/** Diets and formulas of the CEAF are not medicines a prescription names. */
const NOT_MEDICINE = /^(compl|complemento|formula|dieta|suplemento|modulo)\b/;

const sentence = (text: string) => {
  const lower = text.trim().toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

/** Age limits written in the notes. Text that is not about age stays out (it is about handling or dispensing). */
export function ageRules(note: string): ProgramRule[] {
  const text = foldText(note);
  const start = text.match(/inicio de tratamento.*?idade minima de (\d+) anos e idade maxima de (\d+) anos/);
  if (start) {
    return [
      { kind: "min_age", value: Number(start[1]), text: `a partir de ${years(start[1]!)}` },
      {
        kind: "start_max_age",
        value: Number(start[2]),
        text: `para começar o tratamento pelo SUS, até ${start[2]} anos; quem já recebe continua depois`,
      },
    ];
  }
  const rules: ProgramRule[] = [];
  const range = text.match(/disponivel de (\d+) anos? ate (\d+) anos?/);
  const min = text.match(/idade minima:? (?:de )?0*(\d+) anos?/) ?? (range ? [range[0], range[1]] : null);
  const max = text.match(/idade maxima:? (?:de )?0*(\d+) anos?/) ?? (range ? [range[0], range[2]] : null);
  if (min && Number(min[1]) > 0) rules.push({ kind: "min_age", value: Number(min[1]), text: `a partir de ${years(min[1]!)}` });
  if (max && Number(max[1]) < 120) rules.push({ kind: "max_age", value: Number(max[1]), text: `até ${years(max[1]!)}` });
  if (/somente para o sexo feminino/.test(text)) rules.push({ kind: "note", text: "só para mulheres" });
  return rules;
}

export interface RemedioSpDrug {
  words: string;
  activeIngredients: string[];
  /** Protocol names, as the list writes them in sentence case. */
  conditions: string[];
  cids: string[];
  group: string | null;
  /** Age rules, only when every row of the drug says the same (biosimilars differ, e.g. etanercepte). */
  rules: ProgramRule[];
  presentations: { name: string; strength: string; looseMatchKey: string | null }[];
}

export function summarizeRemedioSp(rows: RemedioSpRow[]): Map<string, RemedioSpDrug> {
  const drugs = new Map<string, RemedioSpDrug & { notes: Set<string> }>();
  for (const row of rows) {
    if (row.programa !== "CEAF" || NOT_MEDICINE.test(foldText(row.principioAtivo))) continue;
    const ingredients = cleanActiveIngredient(row.principioAtivo);
    const words = drugWords(looseKey(ingredients));
    if (!words) continue;
    let drug = drugs.get(words);
    if (!drug) {
      drug = { words, activeIngredients: ingredients, conditions: [], cids: [], group: row.grupoFinanciamento, rules: [], presentations: [], notes: new Set() };
      drugs.set(words, drug);
    }
    const condition = sentence(row.codigoProcedimento.replace(/^NSUFICIENCIA/, "INSUFICIENCIA"));
    if (!drug.conditions.includes(condition)) drug.conditions.push(condition);
    if (row.cid && !drug.cids.includes(row.cid)) drug.cids.push(row.cid);
    drug.notes.add(row.observacao ?? "");
    if (!drug.presentations.some((p) => p.name === row.medicamento)) {
      drug.presentations.push({
        name: row.medicamento,
        strength: row.concentracao,
        looseMatchKey: looseMatchKey(ingredients, parseStrengths(foldText(row.concentracao))),
      });
    }
  }
  const out = new Map<string, RemedioSpDrug>();
  for (const [words, { notes, ...drug }] of drugs) {
    const sets = [...notes].map((note) => JSON.stringify(ageRules(note)));
    const rules = new Set(sets).size === 1 ? ageRules([...notes][0]!) : [];
    out.set(words, { ...drug, cids: drug.cids.sort(), rules });
  }
  return out;
}

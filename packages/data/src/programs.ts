/**
 * Programs that give a medicine for free (or cheaper), their items and their rules.
 *
 * One shape for every program: Farmácia Popular, the São Paulo UBS list (REMUME),
 * the Alto Custo (CEAF), and any program added later (home delivery, supplies,
 * lab discounts). The API keeps them in Postgres (benefit_programs tables) and the
 * worker refreshes them every month; seed/programs/*.json is the first load and the
 * fallback when the database is empty.
 *
 * A rule is checked in three states: "yes", "missing" (we do not know, e.g. the
 * diagnosis) and "no" (we know it fails, e.g. she is 62 and the item asks 65+).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { looseKey, looseMatchKey, parseStrengths } from "./lib/normalize.ts";
import { SEED_DIR } from "./lib/paths.ts";

export type ProgramKind = "free" | "high_cost" | "home_delivery" | "supplies" | "discount" | "vaccine" | "info";

export type ProgramRule =
  | { kind: "min_age"; value: number; text: string }
  | { kind: "max_age"; value: number; text: string }
  /** The patient must have one of these conditions (we never know it for sure: always "missing"). */
  | { kind: "condition"; value: string[]; text: string }
  /** IBGE code of the city ("3550308") or state ("35") the patient must live in. */
  | { kind: "residence"; value: string; text: string }
  /** Anything else, shown as written. */
  | { kind: "note"; text: string };

export type RuleStatus = "yes" | "missing" | "no";

export interface BenefitProgram {
  id: string;
  name: string;
  kind: ProgramKind;
  level: "federal" | "state" | "municipal" | "private";
  /** IBGE code where it applies: "BR", a state ("35") or a city ("3550308"). */
  region: string;
  /** Where and how to get it, in pt-BR. */
  channel: string;
  sourceUrl: string;
  /** Date of the official list the items come from (YYYY-MM-DD). */
  version: string;
  /** What to take, in pt-BR. */
  documents: string[];
  /** Rules for every item of the program. */
  rules: ProgramRule[];
}

export interface BenefitProgramItem {
  programId: string;
  /** Stable id inside the program. */
  key: string;
  name: string;
  activeIngredients: string[];
  looseKey: string | null;
  looseMatchKey: string | null;
  extendedRelease: boolean;
  /** "restricted": only some units or patients (REMUME reference services). */
  access: "open" | "restricted";
  /** As the list writes it, e.g. "medicamento disponível em SAE/IST/AIDS". */
  availability: string | null;
  /** CEAF group (1A, 1B, 2). */
  group: string | null;
  /** Diseases the program gives it for (CEAF). Empty: no list. */
  conditions: string[];
  /** CID codes of those diseases, as the doctor writes them on the LME. */
  conditionCodes: string[];
  /** Rules of this item on top of the program's. */
  rules: ProgramRule[];
  sourceUrl: string | null;
}

export interface ProgramFile {
  program: BenefitProgram;
  items: BenefitProgramItem[];
}

/** "XR", "LP", "liberação prolongada"...: a different product from the plain tablet. */
const EXTENDED_RELEASE =
  /\b(xr|xl|lp|sr|cr|mr|od|retard|a[cç][aã]o prolongada|libera[cç][aã]o (prolongada|controlada|modificada|estendida|lenta))\b/i;

export function isExtendedRelease(text: string): boolean {
  return EXTENDED_RELEASE.test(text);
}

export interface Patient {
  /** Age in whole years, null when the family did not give the birth date. */
  age?: number | null;
  /** IBGE city code where she lives. */
  cityIbge?: string | null;
}

export interface CheckedRule {
  kind: ProgramRule["kind"];
  text: string;
  status: RuleStatus;
}

export function checkRule(rule: ProgramRule, patient: Patient = {}): CheckedRule {
  const age = patient.age ?? null;
  const status = ((): RuleStatus => {
    switch (rule.kind) {
      case "min_age":
        return age === null ? "missing" : age >= rule.value ? "yes" : "no";
      case "max_age":
        return age === null ? "missing" : age <= rule.value ? "yes" : "no";
      case "residence":
        if (!patient.cityIbge) return "missing";
        return patient.cityIbge.startsWith(rule.value) ? "yes" : "no";
      default:
        return "missing";
    }
  })();
  return { kind: rule.kind, text: rule.text, status };
}

/** Worst of the states: one "no" fails the item, one "missing" leaves it open. */
export function overall(rules: CheckedRule[]): RuleStatus {
  if (rules.some((rule) => rule.status === "no")) return "no";
  if (rules.some((rule) => rule.status === "missing")) return "missing";
  return "yes";
}

export interface ProgramMatch {
  programId: string;
  name: string;
  kind: ProgramKind;
  access: "open" | "restricted";
  availability: string | null;
  group: string | null;
  conditions: string[];
  conditionCodes: string[];
  documents: string[];
  channel: string;
  /** Item rules, checked against the patient. Program-wide rules (residence) are left to the screen. */
  rules: CheckedRule[];
  status: RuleStatus;
}

export type FreePlace = "farmacia_popular" | "ubs";

export interface FreeAccess {
  /** Where it is free with a plain prescription. Empty when nowhere. */
  freeAt: FreePlace[];
  /** In the São Paulo Alto Custo list: free with the LME form, never automatic. */
  highCost: boolean;
  /** Extra rule of the Farmácia Popular for this item (age, diagnosis), in pt-BR. Null when none. */
  farmaciaPopularRule: string | null;
  /** Diseases the Alto Custo gives it for, from SES-SP. Empty when not Alto Custo or unknown. */
  highCostConditions: string[];
  /** REMUME lists it only at some units (reference services), as the list writes it. */
  ubsRestricted: string | null;
  /** Every program that has it, with its rules checked against the patient. */
  programs: ProgramMatch[];
}

/** Ids of the programs the free/high-cost answer is built from. */
export const PROGRAM_IDS = {
  farmaciaPopular: "farmacia_popular",
  ubs: "remume_sp",
  highCost: "ceaf_sp",
} as const;

interface Entry {
  item: BenefitProgramItem;
  program: BenefitProgram;
}

export class ProgramIndex {
  private readonly byMatch = new Map<string, Entry[]>();
  private readonly byLoose = new Map<string, Entry[]>();
  readonly programs: BenefitProgram[];

  constructor(files: ProgramFile[]) {
    this.programs = files.map((file) => file.program);
    for (const { program, items } of files) {
      for (const item of items) {
        const entry = { item, program };
        if (item.looseMatchKey) push(this.byMatch, item.looseMatchKey, entry);
        if (item.looseKey) push(this.byLoose, item.looseKey, entry);
      }
    }
  }

  get itemCount(): number {
    let count = 0;
    for (const entries of this.byMatch.values()) count += entries.length;
    return count;
  }

  private lookup(ingredients: string[], strength: string | null | undefined) {
    const strengths = parseStrengths(strength ?? "");
    const loose = looseKey(ingredients);
    // The lists write eye drops and sprays per dose ("timolol 2,5 mg", "ipratrópio 0,02 mg") while
    // the box says "2,5 mg/ml" or "20 mcg/dose": the same strength without "/ml" and in mg also counts.
    const exact = [
      ...new Set(
        strengthVariants(strengths).flatMap((variant) => {
          const matchKey = looseMatchKey(ingredients, variant);
          return matchKey ? (this.byMatch.get(matchKey) ?? []) : [];
        }),
      ),
    ];
    const sameDrug = loose ? (this.byLoose.get(loose) ?? []) : [];
    // The strength is in some list: only items of that strength count. Otherwise the drug's
    // Alto Custo entry still says "Alto Custo, in some strength" (the LME is per drug).
    const highCostEntries = (exact.length > 0 ? exact : sameDrug).filter((e) => e.program.id === PROGRAM_IDS.highCost);
    return { exact, highCostEntries };
  }

  /**
   * Looks up a medicine by its active ingredient(s) and strength as written, e.g.
   * ("Losartana Potássica", "50 mg") or ("levodopa + benserazida", "200 mg + 50 mg").
   * `name` is the name on the prescription ("Metformina XR"): an extended-release product is
   * only free where that list has the extended-release item.
   */
  find(activeIngredient: string, strength: string | null | undefined, name?: string | null, patient: Patient = {}): FreeAccess {
    const ingredients = activeIngredient.split("+").map((part) => part.trim()).filter(Boolean);
    let found = this.lookup(ingredients, strength);
    // Combos are listed both ways: "sacubitril + valsartana" and "sacubitril valsartana sódica".
    if (found.exact.length === 0 && found.highCostEntries.length === 0 && ingredients.length > 1) {
      const joined = this.lookup([ingredients.join(" ")], strength);
      if (joined.exact.length > 0 || joined.highCostEntries.length > 0) found = joined;
    }
    const xr = isExtendedRelease(`${name ?? ""} ${activeIngredient} ${strength ?? ""}`);
    const plainExists = found.exact.some((e) => e.program.id !== PROGRAM_IDS.highCost && !e.item.extendedRelease);
    const entries = [...found.exact.filter((e) => e.program.id !== PROGRAM_IDS.highCost), ...found.highCostEntries]
      // An XR prescription only matches XR items. A plain one skips XR items when the plain product exists
      // in some list (plain carbamazepina is not Tegretol CR); when only XR exists (gliclazida 60 mg is sold
      // only as modified release), it still matches. Alto Custo is per drug.
      .filter((e) => {
        if (e.program.id === PROGRAM_IDS.highCost) return true;
        return xr ? e.item.extendedRelease : !e.item.extendedRelease || !plainExists;
      });
    const matches = dedupe(entries).map(({ item, program }) => toMatch(item, program, patient));

    const usable = (id: string) => matches.find((m) => m.programId === id && m.access === "open" && m.status !== "no");
    const fp = usable(PROGRAM_IDS.farmaciaPopular);
    const ubs = usable(PROGRAM_IDS.ubs);
    const freeAt: FreePlace[] = [];
    if (fp) freeAt.push("farmacia_popular");
    if (ubs) freeAt.push("ubs");
    const highCost = matches.find((m) => m.programId === PROGRAM_IDS.highCost);
    const restricted = matches.find((m) => m.programId === PROGRAM_IDS.ubs && m.access === "restricted");
    return {
      freeAt,
      highCost: Boolean(highCost),
      farmaciaPopularRule: fp && fp.rules.length > 0 ? `No Farmácia Popular, ${fp.rules.map((rule) => rule.text).join(" ")}.` : null,
      highCostConditions: highCost?.conditions ?? [],
      ubsRestricted: !ubs && restricted ? restricted.availability : null,
      programs: matches,
    };
  }
}

type Strength = ReturnType<typeof parseStrengths>[number];

/** The strength as written, then per dose without "/ml", then mcg written as mg. */
export function strengthVariants(strengths: Strength[]): Strength[][] {
  if (strengths.length === 0) return [];
  const perDose = strengths.map((s) => ({ ...s, unit: s.unit.replace(/\/(ml|dose|jato|acionamento|actuacao)$/, "") }));
  const inMg = perDose.map((s) => (s.unit === "mcg" ? { value: s.value / 1000, unit: "mg" } : s));
  const out = [strengths, perDose, inMg];
  return out.filter((variant, i) => out.findIndex((other) => JSON.stringify(other) === JSON.stringify(variant)) === i);
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** One match per program: the open item wins over a restricted one. */
function dedupe(entries: Entry[]): Entry[] {
  const byProgram = new Map<string, Entry>();
  for (const entry of entries) {
    const current = byProgram.get(entry.program.id);
    if (!current || (current.item.access === "restricted" && entry.item.access === "open")) {
      byProgram.set(entry.program.id, entry);
    }
  }
  return [...byProgram.values()];
}

function toMatch(item: BenefitProgramItem, program: BenefitProgram, patient: Patient): ProgramMatch {
  const rules = item.rules.map((rule) => checkRule(rule, patient));
  return {
    programId: program.id,
    name: program.name,
    kind: program.kind,
    access: item.access,
    availability: item.availability,
    group: item.group,
    conditions: item.conditions,
    conditionCodes: item.conditionCodes,
    documents: program.documents,
    channel: program.channel,
    rules,
    status: overall(rules),
  };
}

export const PROGRAMS_DIR = join(SEED_DIR, "programs");

/** seed/programs/*.json: the programs shipped with the code. */
export function readProgramFiles(dir = PROGRAMS_DIR): ProgramFile[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as ProgramFile);
}

let seedIndex: ProgramIndex | null = null;

/** Index over the shipped seed files (no database): tests, search and the fallback. */
export function seedProgramIndex(): ProgramIndex {
  seedIndex ??= new ProgramIndex(readProgramFiles());
  return seedIndex;
}

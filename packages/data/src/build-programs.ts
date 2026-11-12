/**
 * Builds seed/programs/*.json (one file per program) from the lists the fetch scripts
 * download: Farmácia Popular, REMUME (São Paulo UBS) and CEAF (Alto Custo, São Paulo).
 *
 * These files are what the API loads into Postgres the first time, and what the worker's
 * monthly job compares the new official lists against.
 *
 * Input: seed/pfpb-free-items.json, seed/remume-sp.json, seed/ceaf.json, seed/ceaf-sp-drugs.txt,
 *        seed/ceaf-sp-guides.json, seed/ceaf-sp-diseases.json, seed/remediosp.json
 * Output: seed/programs/farmacia_popular.json, remume_sp.json, ceaf_sp.json
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CeafItem } from "./fetch-ceaf.ts";
import type { FreeItem } from "./fetch-free-items.ts";
import type { RemumeItem } from "./fetch-remume.ts";
import { slugFor } from "./high-cost-guide.ts";
import { writeJson } from "./lib/csv.ts";
import { foldText, looseKey, looseMatchKey } from "./lib/normalize.ts";
import type { RemedioSpRow } from "./fetch-remediosp.ts";
import { drugWords, summarizeRemedioSp, type RemedioSpDrug } from "./remediosp.ts";
import { ensureDir, SEED_DIR } from "./lib/paths.ts";
import { inStateList, readStateCeaf } from "./link-free-access.ts";
import {
  isExtendedRelease,
  PROGRAMS_DIR,
  type BenefitProgram,
  type BenefitProgramItem,
  type ProgramFile,
  type ProgramRule,
} from "./programs.ts";

/**
 * Farmácia Popular items with extra rules, by loose key.
 * Program rules: Portaria GM/MS 12.091/2026 (documents, prescription valid for 180 days, 365 for
 * contraceptives, and item criteria set by official bodies). Dapagliflozina: Portaria GM/MS 6.613/2025 gives it for "diabetes mellitus associada a doença
 * cardiovascular"; CRF-SP and SES-MG state the 65+ age limit
 * (saude.mg.gov.br/wp-content/uploads/2025/05/DIABETES-MELLITUS-TIPO-2-07.05.25.pdf).
 */
export const FARMACIA_POPULAR_ITEM_RULES: Record<string, ProgramRule[]> = {
  dapagliflozina: [
    { kind: "min_age", value: 65, text: "só para 65 anos ou mais" },
    {
      kind: "condition",
      value: ["Diabetes mellitus tipo 2", "Doença cardiovascular"],
      text: "com diabetes tipo 2 e doença cardiovascular",
    },
  ],
};

const day = (iso: string | undefined) => (iso ?? new Date().toISOString()).slice(0, 10);

export interface ProgramSources {
  free: { source: { url: string; official_list?: string; reference_month?: string; fetched_at?: string }; items: FreeItem[] };
  remume: { source: { url: string; page?: string; fetched_at?: string }; items: RemumeItem[] };
  ceaf: { source: { url: string; fetched_at?: string }; items: CeafItem[] };
  /** Word sets of the São Paulo state list (seed/ceaf-sp-drugs.txt). */
  ceafState: Set<string>[] | null;
  guides: {
    source: { url: string };
    pages: Record<string, string>;
    general: { first: { label: string }[] };
  };
  diseases: { source: { fetched_on: string }; diseases: Record<string, string[]> };
  remedioSp: { source: { url: string; fetched_at?: string }; items: RemedioSpRow[] };
}

export function farmaciaPopularProgram(sources: ProgramSources): ProgramFile {
  const { source, items } = sources.free;
  const program: BenefitProgram = {
    id: "farmacia_popular",
    name: "Farmácia Popular",
    kind: "free",
    level: "federal",
    region: "BR",
    channel: "Em drogaria credenciada ao Farmácia Popular, com a receita.",
    sourceUrl: source.official_list ?? source.url,
    version: source.reference_month ? `${source.reference_month}-01` : day(source.fetched_at),
    documents: ["Receita do médico, do SUS ou particular", "Documento oficial com foto e número do CPF"],
    rules: [{ kind: "note", text: "A receita vale 180 dias (anticoncepcional, 1 ano)." }],
  };
  return {
    program,
    items: items.map((item) => {
      const loose = looseKey(item.active_ingredients);
      return {
        programId: program.id,
        key: item.id,
        name: item.name,
        activeIngredients: item.active_ingredients,
        looseKey: loose,
        looseMatchKey: looseMatchKey(item.active_ingredients, item.strengths),
        extendedRelease: isExtendedRelease(item.name),
        access: "open",
        availability: null,
        group: null,
        conditions: [],
        conditionCodes: [],
        rules: (loose && FARMACIA_POPULAR_ITEM_RULES[loose]) || [],
        sourceUrl: null,
      } satisfies BenefitProgramItem;
    }),
  };
}

export function remumeProgram(sources: ProgramSources): ProgramFile {
  const { source, items } = sources.remume;
  const program: BenefitProgram = {
    id: "remume_sp",
    name: "Posto de saúde (UBS) da Prefeitura de São Paulo",
    kind: "free",
    level: "municipal",
    region: "3550308",
    channel: "Na farmácia da UBS, com a receita.",
    sourceUrl: source.page ?? source.url,
    version: day(source.fetched_at),
    documents: ["Receita do médico", "Cartão do SUS"],
    rules: [],
  };
  return {
    program,
    items: items.map((item) => ({
      programId: program.id,
      key: item.id,
      name: item.name,
      activeIngredients: item.active_ingredients,
      looseKey: looseKey(item.active_ingredients),
      looseMatchKey: item.loose_match_key,
      extendedRelease: isExtendedRelease(item.name),
      access: item.access === "ubs" ? "open" : "restricted",
      availability: item.availability,
      group: null,
      conditions: [],
      conditionCodes: [],
      rules: [],
      sourceUrl: null,
    })),
  };
}

export function ceafSpProgram(sources: ProgramSources): ProgramFile {
  const { items } = sources.ceaf;
  const slugs = Object.keys(sources.guides.pages);
  const drugs = summarizeRemedioSp(sources.remedioSp.items);
  const program: BenefitProgram = {
    id: "ceaf_sp",
    name: "Alto Custo (Farmácia de Medicamentos Especializados do Estado de São Paulo)",
    kind: "high_cost",
    level: "state",
    region: "35",
    channel: "Na Farmácia de Medicamentos Especializados do Estado, depois que o médico preenche o laudo (LME).",
    sourceUrl: sources.guides.source.url,
    version: day(sources.remedioSp.source.fetched_at),
    documents: sources.guides.general.first.map((item) => item.label),
    rules: [{ kind: "note", text: "Só para as doenças do protocolo do Ministério da Saúde, com o laudo LME aprovado." }],
  };
  // Disease names with accents, from the SES-SP pages; the Remédio SP list writes them without.
  const known = new Map<string, string>();
  for (const list of Object.values(sources.diseases.diseases)) for (const name of list) known.set(foldText(name), name);
  const nice = (name: string) => known.get(foldText(name)) ?? name;
  const conditionsFor = (activeIngredients: string[], drug: RemedioSpDrug | undefined) => {
    const slug = slugFor(activeIngredients.join(" + "), slugs);
    const fromPage = (slug && sources.diseases.diseases[slug]) || [];
    return {
      slug,
      conditions: fromPage.length > 0 ? fromPage : (drug?.conditions ?? []).map(nice),
    };
  };

  const state = sources.ceafState;
  const inState = (item: CeafItem) => !state || (item.loose_key !== null && inStateList(item.loose_key, state));
  const out: BenefitProgramItem[] = [];
  const seen = new Set<string>();
  const covered = new Set<string>();
  for (const item of items.filter(inState)) {
    const words = drugWords(item.loose_key);
    const drug = words ? drugs.get(words) : undefined;
    if (words) covered.add(words);
    const { slug, conditions } = conditionsFor(item.active_ingredients, drug);
    const key = `${item.loose_match_key ?? item.ingredient}|${item.presentation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      programId: program.id,
      key,
      name: `${item.ingredient} ${item.presentation}`,
      activeIngredients: item.active_ingredients,
      looseKey: item.loose_key,
      looseMatchKey: item.loose_match_key,
      extendedRelease: isExtendedRelease(item.presentation),
      access: "open",
      availability: null,
      group: item.group,
      conditions,
      conditionCodes: drug?.cids ?? [],
      rules: drug?.rules ?? [],
      sourceUrl: (slug && sources.guides.pages[slug]) || null,
    });
  }
  // Drugs São Paulo lists that the national list we read does not have yet.
  for (const drug of drugs.values()) {
    if (covered.has(drug.words)) continue;
    const { slug, conditions } = conditionsFor(drug.activeIngredients, drug);
    for (const presentation of drug.presentations) {
      out.push({
        programId: program.id,
        key: `remediosp|${presentation.name}`,
        name: presentation.name.toLowerCase(),
        activeIngredients: drug.activeIngredients,
        looseKey: looseKey(drug.activeIngredients),
        looseMatchKey: presentation.looseMatchKey,
        extendedRelease: isExtendedRelease(presentation.name),
        access: "open",
        availability: null,
        group: drug.group,
        conditions,
        conditionCodes: drug.cids,
        rules: drug.rules,
        sourceUrl: (slug && sources.guides.pages[slug]) || null,
      });
    }
  }
  return { program, items: out };
}

export function readProgramSources(dir = SEED_DIR): ProgramSources {
  const read = <T>(name: string) => JSON.parse(readFileSync(join(dir, name), "utf8")) as T;
  return {
    free: read("pfpb-free-items.json"),
    remume: read("remume-sp.json"),
    ceaf: read("ceaf.json"),
    ceafState: readStateCeaf(),
    guides: read("ceaf-sp-guides.json"),
    diseases: read("ceaf-sp-diseases.json"),
    remedioSp: read("remediosp.json"),
  };
}

export function buildPrograms(sources: ProgramSources): ProgramFile[] {
  return [farmaciaPopularProgram(sources), remumeProgram(sources), ceafSpProgram(sources)];
}

async function main(): Promise<void> {
  ensureDir(PROGRAMS_DIR);
  for (const file of buildPrograms(readProgramSources())) {
    writeJson(join(PROGRAMS_DIR, `${file.program.id}.json`), file);
    console.log(`${file.program.id}: ${file.items.length} items`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

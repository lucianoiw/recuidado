/**
 * Reads the official sources again and builds the program files, for the worker's
 * monthly job. Each source can fail on its own (a site down, a blocked network):
 * that program comes back with an error and the database keeps the list it has.
 *
 * - Farmácia Popular: the newest barcode list of the Ministério da Saúde (gov.br).
 * - REMUME: the newest PDF on the Prefeitura de São Paulo page.
 * - Alto Custo: the CEAF list (REMEME/ES PDF) plus Remédio SP (SES-SP public API: diseases,
 *   CID codes and age limits per medicine). The disease names with accents come from the
 *   SES-SP pages read on 12/11/2026 (seed/ceaf-sp-diseases.json): saude.sp.gov.br does not
 *   answer from outside Brazil.
 */
import { ceafSpProgram, farmaciaPopularProgram, readProgramSources, remumeProgram, type ProgramSources } from "./build-programs.ts";
import { parseCeafPdf, toCeafItems } from "./fetch-ceaf.ts";
import { findLatestFreeItemList, groupFreeItems, parseBarcodePdf } from "./fetch-free-items.ts";
import { findRemumePdf, parseRemumePdf, toRemumeItems } from "./fetch-remume.ts";
import { fetchRemedioSp } from "./fetch-remediosp.ts";
import { fetchWithRetry } from "./lib/http.ts";
import type { ProgramFile } from "./programs.ts";
import { SOURCES } from "./sources.ts";

export interface FetchedProgram {
  programId: string;
  file: ProgramFile | null;
  error: string | null;
  /** Problems that did not stop the program, e.g. the national CEAF list did not answer. */
  warnings: string[];
}

async function bytes(url: string): Promise<Uint8Array> {
  const response = await fetchWithRetry(url, { timeoutMs: 300_000 });
  return new Uint8Array(await response.arrayBuffer());
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Reads every official source again. `base` is what is used when one part fails (default: the seed files). */
export async function fetchOfficialPrograms(base: ProgramSources = readProgramSources()): Promise<FetchedProgram[]> {
  const now = new Date().toISOString();
  const run = async (programId: string, build: (warnings: string[]) => Promise<ProgramFile>): Promise<FetchedProgram> => {
    const warnings: string[] = [];
    try {
      return { programId, file: await build(warnings), error: null, warnings };
    } catch (error) {
      return { programId, file: null, error: message(error), warnings };
    }
  };

  return Promise.all([
    run("farmacia_popular", async () => {
      const list = await findLatestFreeItemList();
      const items = groupFreeItems(await parseBarcodePdf(await bytes(list.url)));
      const month = `${list.year}-${String(list.month).padStart(2, "0")}`;
      return farmaciaPopularProgram({
        ...base,
        free: { source: { url: list.url, official_list: SOURCES.pfpbItemsPdf, reference_month: month, fetched_at: now }, items },
      });
    }),
    run("remume_sp", async () => {
      const url = await findRemumePdf();
      const items = toRemumeItems(await parseRemumePdf(await bytes(url)));
      return remumeProgram({ ...base, remume: { source: { url, page: SOURCES.remumePage, fetched_at: now }, items } });
    }),
    run("ceaf_sp", async (warnings) => {
      let ceaf = base.ceaf;
      try {
        ceaf = { source: { url: SOURCES.ceafListPdf, fetched_at: now }, items: toCeafItems(await parseCeafPdf(await bytes(SOURCES.ceafListPdf))) };
      } catch (error) {
        warnings.push(`Lista nacional do CEAF não respondeu (${message(error)}); usada a última.`);
      }
      const items = await fetchRemedioSp();
      return ceafSpProgram({ ...base, ceaf, remedioSp: { source: { url: SOURCES.remedioSpApi, fetched_at: now }, items } });
    }),
  ]);
}


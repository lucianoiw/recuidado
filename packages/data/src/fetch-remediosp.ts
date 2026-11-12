/**
 * Remédio SP (SES-SP): the public list behind remediosp.saude.sp.gov.br, one row per medicine
 * presentation and CID (disease code), with the PCDT (protocol) name, the CEAF group and a note
 * that carries age limits ("IDADE MINIMA: 18 ANOS").
 *
 * Public, no login: GET https://msrec.sp.gov.br/medex/acessos-publicos/medicamentos
 * Found by the thread that maps other programs (12/11/2026). It answers from outside Brazil,
 * unlike saude.sp.gov.br, so the worker's monthly job reads it directly.
 *
 * Output: seed/remediosp.json (only the fields the app uses)
 */
import { writeJson } from "./lib/csv.ts";
import { fetchJson } from "./lib/http.ts";
import { seedPath } from "./lib/paths.ts";
import { SOURCES } from "./sources.ts";

export interface RemedioSpRow {
  medicamento: string;
  principioAtivo: string;
  concentracao: string;
  cid: string;
  /** Name of the protocol (disease), e.g. "ARTRITE REUMATOIDE". */
  codigoProcedimento: string;
  /** "CEAF", "PROTOCOLO ESTADUAL" or "COMPONENTE ESTRATEGICO". */
  programa: string;
  grupoFinanciamento: string;
  observacao: string | null;
  pcdt: string | null;
}

const FIELDS = [
  "medicamento",
  "principioAtivo",
  "concentracao",
  "cid",
  "codigoProcedimento",
  "programa",
  "grupoFinanciamento",
  "observacao",
  "pcdt",
] as const;

export function pickRemedioSp(raw: Record<string, unknown>[]): RemedioSpRow[] {
  return raw
    .filter((row) => typeof row.medicamento === "string" && typeof row.principioAtivo === "string")
    .map((row) => {
      const out: Record<string, unknown> = {};
      for (const field of FIELDS) {
        const value = row[field];
        out[field] = value === undefined || value === "0" ? null : value;
      }
      return out as unknown as RemedioSpRow;
    });
}

export async function fetchRemedioSp(): Promise<RemedioSpRow[]> {
  const raw = await fetchJson<Record<string, unknown>[]>(SOURCES.remedioSpApi, { timeoutMs: 120_000 });
  if (!Array.isArray(raw)) throw new Error("Remédio SP: a resposta não é uma lista.");
  return pickRemedioSp(raw);
}

async function main(): Promise<void> {
  const items = await fetchRemedioSp();
  writeJson(seedPath("remediosp.json"), {
    source: {
      name: "Secretaria de Estado da Saúde de São Paulo, Remédio SP: medicamentos por CID (acesso público)",
      url: SOURCES.remedioSpApi,
      page: "https://remediosp.saude.sp.gov.br",
      fetched_at: new Date().toISOString(),
    },
    items,
  });
  console.log(`Remédio SP: ${items.length} rows, ${new Set(items.map((i) => i.principioAtivo)).size} active ingredients.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

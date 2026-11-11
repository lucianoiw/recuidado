import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fetchJson } from "./http.ts";
import { cachePath } from "./paths.ts";
import { CNES_PHARMACY_TYPE, SOURCES } from "../sources.ts";

/** Fields of /cnes/estabelecimentos that this package reads. */
export interface CnesEstablishment {
  codigo_cnes: number;
  numero_cnpj: string | null;
  numero_cnpj_entidade: string | null;
  nome_razao_social: string | null;
  nome_fantasia: string | null;
  codigo_cep_estabelecimento: string | null;
  endereco_estabelecimento: string | null;
  numero_estabelecimento: string | null;
  bairro_estabelecimento: string | null;
  latitude_estabelecimento_decimo_grau: number | null;
  longitude_estabelecimento_decimo_grau: number | null;
  descricao_turno_atendimento: string | null;
  codigo_municipio: number;
  codigo_uf: number;
  data_atualizacao: string | null;
}

// The API returns at most 20 rows per page, whatever `limit` says.
const PAGE_SIZE = 20;
const CONCURRENCY = 4;

/**
 * Every active pharmacy (CNES type 43) of a municipality. Cached for a week in
 * .cache/ because a large city takes a few hundred requests.
 */
export function fetchMunicipalityPharmacies(municipalityCode: number, maxAgeHours = 168): Promise<CnesEstablishment[]> {
  return fetchMunicipalityEstablishments(municipalityCode, CNES_PHARMACY_TYPE, "pharmacies", maxAgeHours);
}

/** Every active establishment of one CNES type in a municipality, cached in .cache/cnes-<label>-<code>.json. */
export async function fetchMunicipalityEstablishments(
  municipalityCode: number,
  unitType: number,
  label: string,
  maxAgeHours = 168,
): Promise<CnesEstablishment[]> {
  const cache = cachePath(`cnes-${label}-${municipalityCode}.json`);
  if (existsSync(cache) && (Date.now() - statSync(cache).mtimeMs) / 3_600_000 < maxAgeHours) {
    return JSON.parse(readFileSync(cache, "utf8")) as CnesEstablishment[];
  }
  const all: CnesEstablishment[] = [];
  let offset = 0;
  let done = false;
  while (!done) {
    const offsets = Array.from({ length: CONCURRENCY }, (_, i) => offset + i * PAGE_SIZE);
    const pages = await Promise.all(
      offsets.map((pageOffset) => {
        const url = new URL(SOURCES.cnesEstablishments);
        url.searchParams.set("codigo_tipo_unidade", String(unitType));
        url.searchParams.set("codigo_municipio", String(municipalityCode));
        url.searchParams.set("status", "1");
        url.searchParams.set("limit", String(PAGE_SIZE));
        url.searchParams.set("offset", String(pageOffset));
        return fetchJson<{ estabelecimentos: CnesEstablishment[] }>(url.toString());
      }),
    );
    for (const page of pages) {
      all.push(...page.estabelecimentos);
      if (page.estabelecimentos.length < PAGE_SIZE) done = true;
    }
    offset += CONCURRENCY * PAGE_SIZE;
    if (offset % 1000 === 0) console.log(`  CNES ${municipalityCode}: ${all.length} ${label} so far`);
  }
  const unique = [...new Map(all.map((row) => [row.codigo_cnes, row])).values()];
  writeFileSync(cache, JSON.stringify(unique));
  return unique;
}

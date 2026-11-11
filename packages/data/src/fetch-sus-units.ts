/**
 * SUS units of the demo area where medicines are handed out for free.
 *
 * - UBS: CNES type 2 ("Centro de Saúde/Unidade Básica"), kept when the name says
 *   UBS or CSE. Every UBS of São Paulo dispenses the REMUME items marked
 *   access = "ubs" (seed/remume-sp.json). Stock per UBS is only shown by the
 *   "Remédio na Hora" app of the Prefeitura, which has no open API.
 * - Farmácia de Alto Custo: the state "Farmácia Medex" units (CNES type 43,
 *   owner Secretaria de Estado da Saúde de São Paulo). They dispense the CEAF
 *   list (seed/ceaf.json) to people with an approved LME.
 *
 * CNES coordinates are sometimes wrong (a UBS of Brasilândia placed in Bela
 * Vista), so a unit is kept only when its neighbourhood is one of the
 * neighbourhoods of the demo pharmacies or of the area around them.
 *
 * Output: seed/sus-units.json
 */
import { readFileSync } from "node:fs";
import { fetchMunicipalityEstablishments, fetchMunicipalityPharmacies, type CnesEstablishment } from "./lib/cnes.ts";
import { writeJson } from "./lib/csv.ts";
import { distanceKm } from "./lib/geo.ts";
import { foldText } from "./lib/normalize.ts";
import { seedPath } from "./lib/paths.ts";
import { DEMO_REGION } from "./region.ts";
import { CNES_UBS_TYPE, SOURCES } from "./sources.ts";

/** UBS are sparser than pharmacies, so the search goes a bit beyond the pharmacy radius. */
export const SUS_UNIT_RADIUS_KM = 3;

/** Neighbourhoods around Bela Vista (CNES spelling, folded). */
export const DEMO_NEIGHBOURHOODS = [
  "bela vista", "consolacao", "cerqueira cesar", "jardim paulista", "liberdade", "aclimacao",
  "paraiso", "vila mariana", "republica", "se", "centro", "santa cecilia", "higienopolis",
  "pacaembu", "cambuci", "glicerio", "jardins", "jardim america", "vila buarque",
];

export interface SusUnit {
  kind: "ubs" | "ceaf_pharmacy";
  cnes: string;
  name: string;
  street: string | null;
  number: string | null;
  district: string | null;
  postal_code: string | null;
  city: string;
  state: string;
  lat: number;
  lng: number;
  distance_to_center_km: number;
  opening_hours: string | null;
  /** What it hands out for free: "remume_ubs" (REMUME items with access "ubs") or "ceaf". */
  offers: "remume_ubs" | "ceaf";
  cnes_updated_at: string | null;
}

export function isUbs(row: CnesEstablishment): boolean {
  return /^(ubs|ama\s*\/?\s*ubs|cse)\b/.test(foldText(row.nome_fantasia ?? ""));
}

export function isCeafPharmacy(row: CnesEstablishment): boolean {
  const name = foldText(`${row.nome_fantasia ?? ""} ${row.nome_razao_social ?? ""}`);
  return /\bmedex\b/.test(name) && /secretaria de estado da saude/.test(name);
}

function titleCase(text: string | null): string | null {
  if (!text) return null;
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (word) => word.toLowerCase())
    .replace(/\b(Ubs|Cse|Ses|Sp|Drs|Ame|Nga|Hcfmusp|Crt|Iamspe|Hspe)\b/g, (word) => word.toUpperCase());
}

export function toSusUnit(row: CnesEstablishment, kind: SusUnit["kind"]): SusUnit | null {
  const lat = row.latitude_estabelecimento_decimo_grau;
  const lng = row.longitude_estabelecimento_decimo_grau;
  if (lat === null || lng === null) return null;
  const distance = distanceKm(DEMO_REGION.center, { lat, lng });
  if (distance > SUS_UNIT_RADIUS_KM) return null;
  if (!DEMO_NEIGHBOURHOODS.includes(foldText(row.bairro_estabelecimento ?? ""))) return null;
  const name = kind === "ceaf_pharmacy"
    ? (row.nome_fantasia ?? "").replace(/^FARMACIA MEDEX\s*/i, "Farmácia de Alto Custo ")
    : (row.nome_fantasia ?? "");
  return {
    kind,
    cnes: String(row.codigo_cnes).padStart(7, "0"),
    name: titleCase(name)!,
    street: titleCase(row.endereco_estabelecimento),
    number: row.numero_estabelecimento?.trim() || null,
    district: titleCase(row.bairro_estabelecimento),
    postal_code: row.codigo_cep_estabelecimento,
    city: DEMO_REGION.municipalityName,
    state: DEMO_REGION.state,
    lat,
    lng,
    distance_to_center_km: Number(distance.toFixed(2)),
    opening_hours: row.descricao_turno_atendimento,
    offers: kind === "ubs" ? "remume_ubs" : "ceaf",
    cnes_updated_at: row.data_atualizacao,
  };
}

async function main(): Promise<void> {
  const ubsRows = await fetchMunicipalityEstablishments(DEMO_REGION.municipalityCode, CNES_UBS_TYPE, "ubs");
  const pharmacyRows = await fetchMunicipalityPharmacies(DEMO_REGION.municipalityCode);
  const units = [
    ...ubsRows.filter(isUbs).map((row) => toSusUnit(row, "ubs")),
    ...pharmacyRows.filter(isCeafPharmacy).map((row) => toSusUnit(row, "ceaf_pharmacy")),
  ]
    .filter((unit): unit is SusUnit => unit !== null)
    .sort((a, b) => a.distance_to_center_km - b.distance_to_center_km);
  const remume = JSON.parse(readFileSync(seedPath("remume-sp.json"), "utf8")) as { source: { url: string } };
  writeJson(seedPath("sus-units.json"), {
    source: {
      name: "CNES (Ministério da Saúde) via API de dados abertos: UBS (tipo 2) e Farmácias Medex da SES/SP (tipo 43)",
      url: SOURCES.cnesEstablishments,
      remume: remume.source.url,
      ceaf: SOURCES.ceafPage,
      center: DEMO_REGION.center,
      radius_km: SUS_UNIT_RADIUS_KM,
      fetched_at: new Date().toISOString(),
    },
    units,
  });
  console.log(`SUS units: ${units.filter((u) => u.kind === "ubs").length} UBS, ${units.filter((u) => u.kind === "ceaf_pharmacy").length} Alto Custo pharmacies.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

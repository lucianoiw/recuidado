/**
 * Pharmacies of the demo region.
 *
 * Base: CNES (registry of health establishments, Ministério da Saúde), through
 * the DEMAS open data API, establishment type 43 ("Farmácia"), status active.
 * CNES does not say whether a pharmacy is accredited by the Farmácia Popular.
 * The official list of accredited pharmacies is only published as a Qlik panel
 * (SOURCES.pfpbPharmacyPanel) with no download API. When a CSV exported from
 * that panel is saved as raw/pfpb-pharmacies.csv, its CNPJs are used to set
 * fp_accredited; otherwise fp_accredited stays null ("unknown").
 *
 * Output: seed/pharmacies.json
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fetchMunicipalityPharmacies, type CnesEstablishment } from "./lib/cnes.ts";
import { readCsv, writeJson } from "./lib/csv.ts";
import { distanceKm, median } from "./lib/geo.ts";
import { foldText } from "./lib/normalize.ts";
import { RAW_DIR, seedPath } from "./lib/paths.ts";
import { DEMO_REGION } from "./region.ts";
import { SOURCES } from "./sources.ts";

export interface Pharmacy {
  cnes: string;
  cnpj: string | null;
  name: string;
  street: string | null;
  number: string | null;
  district: string | null;
  postal_code: string | null;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  /** True when the point is far from the other pharmacies of the same neighbourhood. */
  coordinates_suspect: boolean;
  distance_to_center_km: number | null;
  opening_hours: string | null;
  /** true/false from the official panel export; null when that export is missing. */
  fp_accredited: boolean | null;
  cnes_updated_at: string | null;
}

const ACCREDITED_EXPORT = join(RAW_DIR, "pfpb-pharmacies.csv");

function digits(value: string | null | undefined): string | null {
  const only = (value ?? "").replace(/\D/g, "");
  return only.length > 0 ? only : null;
}

/** CNPJs found in any column of the panel export whose header mentions "cnpj". */
export function readAccreditedCnpjs(path: string): Set<string> | null {
  if (!existsSync(path)) return null;
  const rows = readCsv(path);
  const cnpjs = new Set<string>();
  for (const row of rows) {
    for (const [column, value] of Object.entries(row)) {
      if (/cnpj/i.test(column)) {
        const cnpj = digits(value)?.padStart(14, "0");
        if (cnpj && cnpj.length === 14) cnpjs.add(cnpj);
      }
    }
  }
  return cnpjs;
}

function titleCase(text: string | null): string | null {
  if (!text) return null;
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());
}

export function cleanPharmacies(rows: CnesEstablishment[], accredited: Set<string> | null): Pharmacy[] {
  const { bounds, center } = DEMO_REGION;
  const inBounds = (lat: number | null, lng: number | null): lat is number =>
    lat !== null && lng !== null && lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;

  // Neighbourhood medians, to flag points geocoded far from their own neighbourhood.
  const located = rows.filter((row) => inBounds(row.latitude_estabelecimento_decimo_grau, row.longitude_estabelecimento_decimo_grau));
  const medians = new Map<string, { lat: number; lng: number }>();
  for (const [district, members] of Map.groupBy(located, (row) => foldText(row.bairro_estabelecimento ?? ""))) {
    if (members.length < 3) continue;
    medians.set(district, {
      lat: median(members.map((m) => m.latitude_estabelecimento_decimo_grau!)),
      lng: median(members.map((m) => m.longitude_estabelecimento_decimo_grau!)),
    });
  }

  return rows.map((row) => {
    const lat = row.latitude_estabelecimento_decimo_grau;
    const lng = row.longitude_estabelecimento_decimo_grau;
    const valid = inBounds(lat, lng);
    const point = valid ? { lat: lat!, lng: lng! } : null;
    const districtMedian = medians.get(foldText(row.bairro_estabelecimento ?? ""));
    const suspect = !point || (districtMedian !== undefined && distanceKm(point, districtMedian) > DEMO_REGION.suspectDistanceKm);
    const cnpj = digits(row.numero_cnpj)?.padStart(14, "0") ?? null;
    return {
      cnes: String(row.codigo_cnes).padStart(7, "0"),
      cnpj,
      name: titleCase(row.nome_fantasia ?? row.nome_razao_social) ?? "Farmácia",
      street: titleCase(row.endereco_estabelecimento),
      number: row.numero_estabelecimento?.trim() || null,
      district: titleCase(row.bairro_estabelecimento),
      postal_code: digits(row.codigo_cep_estabelecimento),
      city: DEMO_REGION.municipalityName,
      state: DEMO_REGION.state,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      coordinates_suspect: suspect,
      distance_to_center_km: point ? Number(distanceKm(point, center).toFixed(2)) : null,
      opening_hours: row.descricao_turno_atendimento,
      fp_accredited: accredited ? (cnpj !== null && accredited.has(cnpj)) : null,
      cnes_updated_at: row.data_atualizacao,
    };
  });
}

async function main(): Promise<void> {
  const rows = await fetchMunicipalityPharmacies(DEMO_REGION.municipalityCode);
  const accredited = readAccreditedCnpjs(ACCREDITED_EXPORT);
  const pharmacies = cleanPharmacies(rows, accredited)
    .filter((p) => p.distance_to_center_km !== null && p.distance_to_center_km <= DEMO_REGION.radiusKm && !p.coordinates_suspect)
    .sort((a, b) => a.distance_to_center_km! - b.distance_to_center_km!);

  writeJson(seedPath("pharmacies.json"), {
    source: {
      name: "Ministério da Saúde, CNES (Cadastro Nacional de Estabelecimentos de Saúde), API de Dados Abertos DEMAS",
      url: `${SOURCES.cnesEstablishments}?codigo_tipo_unidade=43&codigo_municipio=${DEMO_REGION.municipalityCode}&status=1`,
      accreditation: accredited
        ? { name: "Ministério da Saúde, Painel endereço das Farmácias (Farmácia Popular)", url: SOURCES.pfpbPharmacyPanel }
        : null,
      fetched_at: new Date().toISOString(),
    },
    region: {
      municipality: DEMO_REGION.municipalityName,
      state: DEMO_REGION.state,
      center: DEMO_REGION.center,
      radius_km: DEMO_REGION.radiusKm,
    },
    municipality_total: rows.length,
    pharmacies,
  });
  const accreditedCount = pharmacies.filter((p) => p.fp_accredited).length;
  console.log(
    `${pharmacies.length} pharmacies within ${DEMO_REGION.radiusKm} km of ${DEMO_REGION.center.name} ` +
      `(${rows.length} in the municipality). Farmácia Popular: ${accredited ? `${accreditedCount} accredited` : "unknown, no panel export in raw/"}.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

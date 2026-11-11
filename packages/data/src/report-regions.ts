/**
 * Ranks neighbourhoods of the demo municipality by how many CNES pharmacies,
 * with plausible coordinates, sit within the demo radius of their centre.
 * Used to choose DEMO_REGION.center. Prints a table; writes nothing.
 */
import { fetchMunicipalityPharmacies } from "./lib/cnes.ts";
import { distanceKm, median } from "./lib/geo.ts";
import { foldText } from "./lib/normalize.ts";
import { DEMO_REGION } from "./region.ts";

const MIN_PHARMACIES_IN_DISTRICT = 5;

export interface DistrictScore {
  district: string;
  pharmaciesInDistrict: number;
  pharmaciesWithinRadius: number;
  lat: number;
  lng: number;
}

async function main(): Promise<void> {
  const all = await fetchMunicipalityPharmacies(DEMO_REGION.municipalityCode);
  const { bounds } = DEMO_REGION;
  const points = all
    .filter((row) => row.latitude_estabelecimento_decimo_grau !== null && row.longitude_estabelecimento_decimo_grau !== null)
    .map((row) => ({
      lat: row.latitude_estabelecimento_decimo_grau!,
      lng: row.longitude_estabelecimento_decimo_grau!,
      district: foldText(row.bairro_estabelecimento ?? ""),
    }))
    .filter((p) => p.lat >= bounds.minLat && p.lat <= bounds.maxLat && p.lng >= bounds.minLng && p.lng <= bounds.maxLng);

  const byDistrict = Map.groupBy(points, (p) => p.district);
  const scores: DistrictScore[] = [];
  for (const [district, members] of byDistrict) {
    if (!district || members.length < MIN_PHARMACIES_IN_DISTRICT) continue;
    const centre = { lat: median(members.map((m) => m.lat)), lng: median(members.map((m) => m.lng)) };
    scores.push({
      district,
      pharmaciesInDistrict: members.length,
      pharmaciesWithinRadius: points.filter((p) => distanceKm(p, centre) <= DEMO_REGION.radiusKm).length,
      lat: Number(centre.lat.toFixed(4)),
      lng: Number(centre.lng.toFixed(4)),
    });
  }
  scores.sort((a, b) => b.pharmaciesWithinRadius - a.pharmaciesWithinRadius);
  console.log(`${all.length} active pharmacies in CNES for ${DEMO_REGION.municipalityName}; ${points.length} with coordinates inside the municipality.`);
  console.table(scores.slice(0, 15));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

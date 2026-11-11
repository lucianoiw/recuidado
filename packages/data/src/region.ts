/**
 * Demo region. The data is collected only for this area (decision of 10/11/2026:
 * pharmacies only for the demo region, chosen by the most complete base).
 * See README.md for how it was chosen and src/report-regions.ts to redo the choice.
 */
export const DEMO_REGION = {
  state: "SP",
  /** IBGE state code. */
  stateCode: 35,
  /** IBGE municipality code with 6 digits, as the CNES API expects (São Paulo capital). */
  municipalityCode: 355030,
  municipalityName: "São Paulo",
  /** Coordinates outside this box are treated as wrong (municipality limits with a small margin). */
  bounds: { minLat: -24.02, maxLat: -23.35, minLng: -46.83, maxLng: -46.36 },
  /**
   * The demo area: a circle around the median CNES coordinate of Bela Vista, the
   * neighbourhood with the most pharmacies within 2 km in CNES on 11/11/2026
   * (66 of 1007). Run `pnpm report:regions` to see the ranking again.
   */
  center: { name: "Bela Vista", lat: -23.5636, lng: -46.6534 },
  radiusKm: 2,
  /** A pharmacy farther than this from its neighbourhood median gets coordinates_suspect = true. */
  suspectDistanceKm: 2.5,
} as const;

/**
 * ICMS rate used to pick the CMED PMC column for the demo state.
 * São Paulo: 18% for medicines and 12% for generics (RICMS/SP, reduction for
 * generics in force since 23/02/2016). Products marked "ICMS 0%" by CMED use 0%.
 */
export function icmsRateFor(productType: string, icmsZero: boolean): 0 | 12 | 18 {
  if (icmsZero) return 0;
  return /gen[eé]rico/i.test(productType) ? 12 : 18;
}

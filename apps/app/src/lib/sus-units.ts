import data from "./sus-units.json";

export interface SusUnit {
  kind: "ubs" | "ceaf_pharmacy";
  cnes: string;
  name: string;
  address: string;
  district: string;
  distanceKm: number;
  lat: number;
  lng: number;
  hours: string;
}

/** UBS (REMUME list) and state high cost pharmacies (CEAF) near the demo address, from CNES. */
export const susUnits: SusUnit[] = (data.units as SusUnit[]).sort((a, b) => a.distanceKm - b.distanceKm);
export const ubsUnits = susUnits.filter((u) => u.kind === "ubs");
export const highCostUnits = susUnits.filter((u) => u.kind === "ceaf_pharmacy");

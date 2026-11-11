import data from "./pharmacies.json";

export interface Pharmacy {
  cnes: string;
  name: string;
  address: string;
  district: string;
  distanceKm: number;
  lat: number;
  lng: number;
  /** null while the Farmácia Popular accreditation is not crossed yet. */
  fpAccredited: boolean | null;
}

/** Nearest pharmacies to the demo address, from CNES (public data). */
export const pharmacies: Pharmacy[] = data.pharmacies as Pharmacy[];

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 100) * 10} m` : `${km.toFixed(1).replace(".", ",")} km`;
}

export function mapsUrl(p: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}

export type CepLookup =
  | { state: "idle" | "loading" | "not-found" | "error" }
  | { state: "found"; street: string; district: string; city: string; uf: string };

/** Looks up a Brazilian postal code with the public ViaCEP service. */
export async function lookupCep(cep: string, signal?: AbortSignal): Promise<CepLookup> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return { state: "idle" };
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
    if (!res.ok) return { state: "not-found" };
    const body = (await res.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
    if (body.erro) return { state: "not-found" };
    return { state: "found", street: body.logradouro ?? "", district: body.bairro ?? "", city: body.localidade ?? "", uf: body.uf ?? "" };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return { state: "loading" };
    return { state: "error" };
  }
}

/**
 * Rough point of a postal code, to show the area on a map: the street from ViaCEP geocoded by
 * OpenStreetMap (Nominatim), else the district. Null when nothing is found.
 */
export async function locateCep(
  found: { street: string; district: string; city: string; uf: string },
  signal?: AbortSignal,
): Promise<{ lat: number; lng: number } | null> {
  const tries = [found.street, found.district].filter(Boolean);
  for (const street of tries) {
    const q = new URLSearchParams({ format: "json", limit: "1", countrycodes: "br", street, city: found.city, state: found.uf });
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { signal });
      if (!res.ok) continue;
      const [hit] = (await res.json()) as { lat: string; lon: string }[];
      if (hit) return { lat: Number(hit.lat), lng: Number(hit.lon) };
    } catch {
      return null;
    }
  }
  return null;
}

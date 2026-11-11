export type CepLookup =
  | { state: "idle" | "loading" | "not-found" | "error" }
  | { state: "found"; district: string; city: string; uf: string };

/** Looks up a Brazilian postal code with the public ViaCEP service. */
export async function lookupCep(cep: string, signal?: AbortSignal): Promise<CepLookup> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return { state: "idle" };
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
    if (!res.ok) return { state: "not-found" };
    const body = (await res.json()) as { erro?: boolean | string; bairro?: string; localidade?: string; uf?: string };
    if (body.erro) return { state: "not-found" };
    return { state: "found", district: body.bairro ?? "", city: body.localidade ?? "", uf: body.uf ?? "" };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return { state: "loading" };
    return { state: "error" };
  }
}

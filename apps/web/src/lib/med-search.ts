import { API_URL } from "./api";

export type MedStrength = {
  strength: string;
  form: string | null;
  freeAt: ("farmacia_popular" | "ubs")[];
  highCost: boolean;
};

/** One medicine from GET /medications/search (CMED list): a generic or a brand. */
export type MedResult = {
  name: string;
  activeIngredient: string;
  kind: "generic" | "brand";
  laboratory: string | null;
  strengths: MedStrength[];
};

// Fallback when the API cannot be reached, so the demo still suggests common names.
const LOCAL: [string, string[]][] = [
  ["Anlodipino", ["5 mg", "10 mg"]],
  ["Atenolol", ["25 mg", "50 mg"]],
  ["Losartana potássica", ["25 mg", "50 mg", "100 mg"]],
  ["Metformina", ["500 mg", "850 mg"]],
  ["Omeprazol", ["20 mg"]],
  ["Rosuvastatina", ["10 mg", "20 mg"]],
  ["Sinvastatina", ["20 mg", "40 mg"]],
];

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

function searchLocal(q: string): MedResult[] {
  const f = fold(q);
  return LOCAL.filter(([n]) => fold(n).includes(f)).map(([name, strengths]) => ({
    name,
    activeIngredient: name,
    kind: "generic",
    laboratory: null,
    strengths: strengths.map((strength) => ({ strength, form: null, freeAt: [], highCost: false })),
  }));
}

/** Medicines matching what the family typed. Fewer than 2 letters returns []. */
export async function searchMedications(q: string, signal?: AbortSignal): Promise<MedResult[]> {
  if (q.trim().length < 2) return [];
  try {
    const res = await fetch(`${API_URL}/medications/search?q=${encodeURIComponent(q.trim())}&limit=8`, {
      signal,
    });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as MedResult[];
  } catch (e) {
    if (signal?.aborted) throw e;
    return searchLocal(q);
  }
}

/** Distinct strengths of a medicine, in API order, marking the ones that can be free. */
export function strengthChoices(m: MedResult): { strength: string; free: boolean }[] {
  const seen = new Map<string, boolean>();
  for (const s of m.strengths) {
    seen.set(s.strength, (seen.get(s.strength) ?? false) || s.freeAt.length > 0);
  }
  return [...seen].map(([strength, free]) => ({ strength, free }));
}

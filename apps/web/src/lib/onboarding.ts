// Onboarding answers. The API has no sign-up endpoint yet, so the demo keeps
// them in this browser only; the family shown afterwards is the API demo family.

export const RELATIONS = [
  "Filho(a)",
  "Neto(a)",
  "Sobrinho(a)",
  "Cônjuge",
  "Irmão(ã)",
  "Genro/Nora",
  "Cuidador(a) profissional",
  "Amigo(a)/Vizinho(a)",
  "Outro",
] as const;

export type Relation = (typeof RELATIONS)[number];

export interface Onboarding {
  caregiver: { name: string; phone: string; relation: Relation | null; relationOther: string };
  patient: { name: string; nickname: string; phone: string; birth: string; cep: string; usesPhone: boolean };
  invites: { name: string; phone?: string; relation: Relation | null }[];
}

export const emptyOnboarding: Onboarding = {
  caregiver: { name: "", phone: "", relation: null, relationOther: "" },
  patient: { name: "", nickname: "", phone: "", birth: "", cep: "", usesPhone: true },
  invites: [],
};

const KEY = "recuidado:onboarding";

export function loadOnboarding(): Onboarding | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyOnboarding, ...(JSON.parse(raw) as Onboarding) } : null;
  } catch {
    return null;
  }
}

export function saveOnboarding(data: Onboarding): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

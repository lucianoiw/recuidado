// Onboarding answers of the signed-in caregiver. Saved in the API (PUT /family/onboarding).

import { maskCep, maskPhone } from "./masks";
import type { OnboardingRecord, SplitMode } from "./api";

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
  caregiver: { name: string; phone: string; email: string; relation: Relation | null; relationOther: string };
  patient: { name: string; nickname: string; gender: "female" | "male"; phone: string; birth: string; cep: string; usesPhone: boolean; consent: boolean };
  invites: { name: string; phone?: string; email?: string; relation: Relation | null }[];
  /** How the siblings pay, people by name in the rotation order. */
  payment: { mode: SplitMode; people: { name: string; excluded: boolean }[] };
}

export const emptyOnboarding: Onboarding = {
  caregiver: { name: "", phone: "", email: "", relation: null, relationOther: "" },
  patient: { name: "", nickname: "", gender: "female", phone: "", birth: "", cep: "", usesPhone: true, consent: false },
  invites: [],
  payment: { mode: "split", people: [] },
};

function asRelation(v: string | null): Relation | null {
  return (RELATIONS as readonly string[]).includes(v ?? "") ? (v as Relation) : null;
}

/** API record to form values (masked phone, CEP and dd/mm/aaaa). */
export function fromRecord(r: OnboardingRecord): Onboarding {
  const [y, m, d] = r.patient.birth.split("-");
  return {
    caregiver: {
      name: r.caregiver.name,
      phone: maskPhone(r.caregiver.phone),
      email: r.caregiver.email ?? "",
      relation: asRelation(r.caregiver.relation),
      relationOther: r.caregiver.relationOther,
    },
    patient: {
      ...r.patient,
      phone: maskPhone(r.patient.phone),
      cep: maskCep(r.patient.cep),
      birth: d ? `${d}/${m}/${y}` : "",
    },
    invites: r.invites.map((i) => ({
      name: i.name,
      phone: i.phone ?? "",
      email: i.email ?? "",
      relation: asRelation(i.relation),
    })),
    payment: r.payment ?? { mode: "split", people: [] },
  };
}

/** The payment people kept in their order, with the caregiver and the invites added or removed. */
export function paymentOf(d: Onboarding): Onboarding["payment"] {
  const names = [d.caregiver.name.trim(), ...d.invites.map((i) => i.name.trim())].filter(Boolean);
  const key = (n: string) => n.trim().toLocaleLowerCase("pt-BR");
  const wanted = new Set(names.map(key));
  const kept = d.payment.people.filter((p) => wanted.has(key(p.name)));
  const seen = new Set(kept.map((p) => key(p.name)));
  return {
    mode: d.payment.mode,
    people: [...kept, ...names.filter((n) => !seen.has(key(n))).map((name) => ({ name, excluded: false }))],
  };
}

/** "novembro": this month in São Paulo. */
export function thisMonthName(now = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" }).format(now);
}

// Onboarding answers. Saved in the API (PUT /family/onboarding) into the demo family;
// this device keeps only the caregiver id (lib/me.ts).

import { maskCep, maskPhone } from "./masks";
import type { OnboardingRecord } from "./api";

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
  patient: { name: string; nickname: string; phone: string; birth: string; cep: string; usesPhone: boolean; consent: boolean };
  invites: { name: string; phone?: string; relation: Relation | null }[];
}

export const emptyOnboarding: Onboarding = {
  caregiver: { name: "", phone: "", relation: null, relationOther: "" },
  patient: { name: "", nickname: "", phone: "", birth: "", cep: "", usesPhone: true, consent: false },
  invites: [],
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
      relation: asRelation(i.relation),
    })),
  };
}

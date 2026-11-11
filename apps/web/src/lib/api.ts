export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type DoseStatus = "pending" | "taken" | "missed";

export interface Dose {
  id: string;
  scheduledAt: string;
  status: DoseStatus;
  confirmedVia: "app" | "voice" | null;
  confirmedAt: string | null;
  familyAlertedAt: string | null;
  medicationId: string;
  medicationName: string;
  strength: string | null;
}

export interface Member {
  id: string;
  name: string;
  role: "caregiver" | "patient";
}

export interface Medication {
  id: string;
  name: string;
  strength: string | null;
  times: string[];
  freeInFarmaciaPopular: boolean;
  monthlyCostCents: number;
}

export interface FamilyOverview {
  familyId: string;
  patient: Member;
  caregivers: Member[];
  medications: Medication[];
  today: Dose[];
}

export async function getFamily(): Promise<FamilyOverview> {
  const res = await fetch(`${API_URL}/family`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function confirmDose(doseId: string): Promise<void> {
  const res = await fetch(`${API_URL}/doses/${doseId}/confirm`, { method: "POST" });
  if (!res.ok) throw new Error(`API ${res.status}`);
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

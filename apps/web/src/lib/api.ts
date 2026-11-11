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
  /** Where it is free: "farmacia_popular", "ubs". Optional until the API sends it. */
  freeAt?: string[];
  /** In the state high cost program (CEAF): needs the LME form from the doctor. */
  highCost?: boolean;
}

export interface FamilyOverview {
  familyId: string;
  patient: Member;
  caregivers: Member[];
  medications: Medication[];
  today: Dose[];
}

/** Free somewhere: Farmácia Popular or the UBS pharmacy. */
export function isFree(m: Medication): boolean {
  return m.freeInFarmaciaPopular || (m.freeAt?.length ?? 0) > 0;
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

/** The fields of POST /prescriptions/parse that the review screen uses. */
export interface ReadItem {
  medication_name: string;
  active_ingredient: string | null;
  strength: { text: string };
  frequency: { text: string; as_needed: boolean };
  schedule: { time: string }[];
  instructions: string | null;
  needs_review: boolean;
  review_reason: string | null;
}

export interface ReadResult {
  reading: {
    is_prescription: boolean;
    legibility: "good" | "partial" | "poor";
    items: ReadItem[];
    warnings: string[];
  };
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    const msg = Array.isArray(body.message) ? body.message[0] : body.message;
    return msg || fallback;
  } catch {
    return fallback;
  }
}

export async function parsePrescription(file: File): Promise<ReadResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/prescriptions/parse`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await errorMessage(res, "Não deu para ler a receita."));
  return res.json();
}

export interface ConfirmItem {
  name: string;
  activeIngredient: string | null;
  strength: string | null;
  times: string[];
}

export async function confirmPrescription(patientId: string, items: ConfirmItem[]): Promise<void> {
  const res = await fetch(`${API_URL}/prescriptions/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ patientId, items }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Não deu para salvar."));
}

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
  /** How the family calls the patient, e.g. "Dona Maria". */
  nickname?: string | null;
  role: "caregiver" | "patient";
  relation?: string | null;
  relationOther?: string | null;
  /** Invited during sign-up and has not opened the app yet. */
  pending?: boolean;
  /** Digits only, e.g. "11987654321". */
  phone?: string | null;
}

/** The name screens show for the patient: the nickname when there is one. */
export function callName(p: Member): string {
  return p.nickname?.trim() || p.name;
}

export interface Medication {
  id: string;
  name: string;
  strength: string | null;
  times: string[];
  freeInFarmaciaPopular: boolean;
  monthlyCostCents: number;
  /** Free in Farmácia Popular, but the family chose to buy it. */
  buyInsteadOfFree?: boolean;
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
  /** Calls of the last 24 hours where she said she is not feeling well. */
  unwellReports?: { at: string; note: string | null; doseId: string }[];
}

/** tel: link for a member, or null when there is no phone. */
export function telHref(m: Member): string | null {
  const digits = m.phone?.replace(/\D/g, "") ?? "";
  return digits.length >= 10 ? `tel:+55${digits}` : null;
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

async function send(method: string, path: string, body: unknown, fallback: string): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await errorMessage(res, fallback));
  return res;
}

/** "Pegar grátis" (buy = false) or "Comprar" (buy = true). */
export async function setBuyChoice(medicationId: string, buy: boolean): Promise<void> {
  await send("PUT", `/family/medications/${medicationId}/buy-choice`, { buy }, "Não deu para salvar.");
}

/** An invited caregiver opened the app and picked their name. */
export async function joinFamily(memberId: string): Promise<void> {
  const res = await fetch(`${API_URL}/family/members/${memberId}/join`, { method: "POST" });
  if (!res.ok) throw new Error(`API ${res.status}`);
}

/** Sign-up answers as the API stores them: phone and CEP in digits, birth as aaaa-mm-dd. */
export interface OnboardingRecord {
  caregiverId: string;
  caregiver: { name: string; phone: string; relation: string | null; relationOther: string };
  patient: { name: string; nickname: string; phone: string; birth: string; cep: string; usesPhone: boolean };
  invites: { id: string; name: string; relation: string | null; phone?: string; joined: boolean }[];
}

/** Null when this caregiver is not in the family anymore. */
export async function getOnboarding(caregiverId: string): Promise<OnboardingRecord | null> {
  const res = await fetch(`${API_URL}/family/onboarding?caregiverId=${caregiverId}`, { cache: "no-store" });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function saveOnboarding(body: unknown): Promise<{ caregiverId: string }> {
  const res = await send("PUT", "/family/onboarding", body, "Não deu para salvar o cadastro.");
  return res.json();
}

/** Family edits the dose text or the times of a medication. */
export async function updateMedication(
  id: string,
  body: { strength?: string | null; times?: string[] },
): Promise<void> {
  await send("PATCH", `/family/medications/${id}`, body, "Não deu para salvar a mudança.");
}

/** Family stops a medication. */
export async function removeMedication(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/family/medications/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await errorMessage(res, "Não deu para tirar o remédio."));
}

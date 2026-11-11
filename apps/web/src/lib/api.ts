import { setFamilyId, withFamily } from "./family-id";

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
  /** Added as an invite by another caregiver. */
  invited?: boolean;
  /** Invited during sign-up and has not opened the app yet. */
  pending?: boolean;
  /** Digits only, e.g. "11987654321". In the demo family it comes masked: "(11) •••••-4321". */
  phone?: string | null;
  /** Has a full phone number saved, even when the API sends it masked. */
  hasPhone?: boolean;
  /** Caregiver only: the one phoned when she reports an emergency on the call. */
  emergencyContact?: boolean;
  /** Patient only (LGPD): when she agreed to reminders and calls, and who said so. */
  consentAt?: string | null;
  consentSource?: "patient" | "caregiver" | null;
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
  /** Pills left at home and how many days they last; null when nobody counted them. */
  stock?: Stock | null;
  /** Where the family is in the Alto Custo path; null when it is not in the list. */
  highCostPath?: HighCostStatus | null;
  /** CMED ceiling price (PMC, São Paulo); null when the list has no match. */
  price?: MedicationPrice | null;
}

export interface MedicationPrice {
  /** Cheapest presentation on the CMED list, for a month of doses. Null without fixed times. */
  monthlyCents: number | null;
  monthlyMaxCents: number | null;
  packCents: number;
  unitsPerPack: number;
  product: string;
  /** "2026-11-09": publication date of the CMED list. */
  listDate: string | null;
}

export interface HighCostItem {
  id: string;
  who: "doctor" | "family";
  label: string;
  detail?: string;
}

/** What SES-SP asks to give a medicine through the Alto Custo (CEAF), from its leaflets. */
export interface HighCostGuide {
  disease: string | null;
  pageUrl: string;
  leafletUrl: string | null;
  updatedOn: string | null;
  specific: boolean;
  lmeValidDays: number;
  renewalMonths: number | null;
  firstRequest: HighCostItem[];
  renewal: HighCostItem[];
  notes: string[];
  representative: string[];
  sources: { ministry: string; lmeForm: string; stock: string };
}

export interface HighCostStatus {
  checked: string[];
  /** aaaa-mm-dd */
  lmeFilledOn: string | null;
  since: string | null;
  stage: "first" | "renewal";
  done: number;
  total: number;
  lmeDeliverBy: string | null;
  renewBy: string | null;
  due: { kind: "lme" | "renewal"; by: string; daysLeft: number } | null;
}

export interface HighCostPath {
  medication: { id: string; name: string; strength: string | null; monthlyCostCents: number; highCost: boolean };
  guide: HighCostGuide;
  status: HighCostStatus;
}

export async function getHighCost(medicationId: string): Promise<HighCostPath> {
  const res = await fetch(`${API_URL}${withFamily(`/family/medications/${medicationId}/high-cost`)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Não deu para abrir o caminho do Alto Custo."));
  return res.json();
}

export async function saveHighCost(
  medicationId: string,
  body: { checked?: string[]; lmeFilledOn?: string | null; since?: string | null },
): Promise<void> {
  await send("PUT", withFamily(`/family/medications/${medicationId}/high-cost`), body, "Não deu para salvar.");
}

export interface Stock {
  units: number;
  /** Null for a medicine without times. */
  daysLeft: number | null;
  /** Few days left: time to get more. */
  low: boolean;
}

export type AlertKind = "dose_missed" | "unwell" | "low_stock" | "emergency" | "emergency_call" | "check_in";

export interface FamilyAlert {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  /** Phones that got the push. 0 for entries that were a phone call. */
  pushesDelivered: number;
  createdAt: string;
}

/** Alerts sent to the family, newest first. */
export async function getAlerts(): Promise<FamilyAlert[]> {
  const res = await fetch(`${API_URL}${withFamily("/family/alerts")}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export interface FamilyOverview {
  familyId: string;
  /** The demo family (Dona Maria): shown to visitors without a sign-up, read-only. */
  isDemo?: boolean;
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
  const res = await fetch(`${API_URL}${withFamily("/family")}`, { cache: "no-store" });
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
  // The family id lets the API count reads per family (it limits reads per day).
  const res = await fetch(`${API_URL}${withFamily("/prescriptions/parse")}`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await errorMessage(res, "Não deu para ler a receita."));
  return res.json();
}

export interface ConfirmItem {
  name: string;
  activeIngredient: string | null;
  strength: string | null;
  times: string[];
  /** Pills at home, when the family knows. */
  stockUnits?: number | null;
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

/** The caregiver phoned when she reports an emergency on the call; the others get only the push. */
export async function setEmergencyContact(memberId: string): Promise<void> {
  await send("PUT", withFamily(`/family/members/${memberId}/emergency-contact`), {}, "Não deu para salvar o primeiro contato.");
}

/** "Pegar grátis" (buy = false) or "Comprar" (buy = true). */
export async function setBuyChoice(medicationId: string, buy: boolean): Promise<void> {
  await send("PUT", withFamily(`/family/medications/${medicationId}/buy-choice`), { buy }, "Não deu para salvar.");
}

/** An invited caregiver opened the app and picked their name. */
export async function joinFamily(memberId: string): Promise<void> {
  const res = await fetch(`${API_URL}${withFamily(`/family/members/${memberId}/join`)}`, { method: "POST" });
  if (!res.ok) throw new Error(`API ${res.status}`);
}

/** Sign-up answers as the API stores them: phone and CEP in digits, birth as aaaa-mm-dd. */
export interface OnboardingRecord {
  familyId: string;
  caregiverId: string;
  caregiver: { name: string; phone: string; relation: string | null; relationOther: string };
  patient: { name: string; nickname: string; phone: string; birth: string; cep: string; usesPhone: boolean; consent: boolean };
  invites: { id: string; name: string; relation: string | null; phone?: string; joined: boolean }[];
}

/** Null when this caregiver is not in the family anymore. */
export async function getOnboarding(caregiverId: string): Promise<OnboardingRecord | null> {
  const res = await fetch(`${API_URL}/family/onboarding?caregiverId=${caregiverId}`, { cache: "no-store" });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`API ${res.status}`);
  const record = (await res.json()) as OnboardingRecord;
  setFamilyId(record.familyId);
  return record;
}

/** Saves the sign-up. A new sign-up gets its own family, which this device then follows. */
export async function saveOnboarding(body: unknown): Promise<{ caregiverId: string; familyId: string }> {
  const res = await send("PUT", "/family/onboarding", body, "Não deu para salvar o cadastro.");
  const saved = (await res.json()) as { caregiverId: string; familyId: string };
  setFamilyId(saved.familyId);
  return saved;
}

/** Family edits the dose text or the times of a medication. */
export async function updateMedication(
  id: string,
  body: { strength?: string | null; times?: string[]; stockUnits?: number | null },
): Promise<void> {
  await send("PATCH", withFamily(`/family/medications/${id}`), body, "Não deu para salvar a mudança.");
}

/** Family stops a medication. */
export async function removeMedication(id: string): Promise<void> {
  const res = await fetch(`${API_URL}${withFamily(`/family/medications/${id}`)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await errorMessage(res, "Não deu para tirar o remédio."));
}

export type DemoStepState = "waiting" | "active" | "done" | "skipped" | "failed";

export interface DemoStep {
  state: DemoStepState;
  /** When a waiting step is due. */
  at: string | null;
  detail: string | null;
}

/** GET /demo/run/:doseId: where the 2 minute demo is. */
export interface DemoRun {
  doseId: string;
  startedAt: string;
  status: DoseStatus;
  reminder: DemoStep;
  call: DemoStep;
  family: DemoStep;
  finished: boolean;
  transcript: { speaker: "assistant" | "patient"; text: string }[];
}

/** Starts the demo run, or returns the one already going. */
export async function startDemoRun(): Promise<{ doseId: string; alreadyRunning: boolean }> {
  const res = await fetch(`${API_URL}/demo/run`, { method: "POST" });
  if (!res.ok) throw new Error(await errorMessage(res, "Não deu para começar a demo."));
  return res.json();
}

export async function getDemoRun(doseId: string): Promise<DemoRun> {
  const res = await fetch(`${API_URL}/demo/run/${doseId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** The patient accepts (or takes back) reminders, calls and the family seeing her doses. */
export async function setConsent(patientId: string, accepted: boolean): Promise<void> {
  await send("PUT", `/privacy/consent/${patientId}`, { accepted }, "Não deu para salvar a sua resposta.");
}

/** Link that downloads everything stored about the family of this caregiver (JSON). */
export function exportDataUrl(caregiverId: string): string {
  return `${API_URL}/privacy/export?caregiverId=${caregiverId}`;
}

/** Deletes the family of this caregiver and everything under it. */
export async function deleteFamilyData(caregiverId: string): Promise<void> {
  const res = await fetch(`${API_URL}/privacy/family?caregiverId=${caregiverId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await errorMessage(res, "Não deu para apagar os dados."));
}

export type TriState = "yes" | "no" | "unknown";

/** A voice call to a pharmacy asking stock, price and Farmácia Popular. */
export interface PharmacyInquiry {
  id: string;
  pharmacyName: string;
  status: "calling" | "answered" | "unclear" | "no_answer" | "failed";
  medications: { medicationId: string; name: string; strength: string | null }[];
  answers: {
    medication: string;
    available: TriState;
    /** Price of one box said on the phone. Reference, not an offer. */
    priceCents: number | null;
    package?: string;
    farmaciaPopular: TriState;
  }[];
  note: string | null;
  /** The call went through a recorded menu (keys pressed). */
  usedPhoneMenu: boolean;
  transcript: { speaker: "assistant" | "patient"; text: string }[];
  durationSeconds: number | null;
  createdAt: string;
  finishedAt: string | null;
}

/** "Perguntar à farmácia": the voice agent calls the pharmacy about these medicines. */
export async function askPharmacy(medicationIds: string[]): Promise<PharmacyInquiry> {
  const res = await send("POST", withFamily("/pharmacy-inquiries"), { medicationIds }, "Não deu para ligar agora.");
  return res.json();
}

/** The family's most recent pharmacy call, or null. */
export async function getLatestPharmacyInquiry(): Promise<PharmacyInquiry | null> {
  const res = await fetch(`${API_URL}${withFamily("/pharmacy-inquiries/latest")}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return ((await res.json()) as { inquiry: PharmacyInquiry | null }).inquiry;
}

export interface MonthItem {
  id: string;
  name: string;
  strength: string | null;
  monthlyCents: number;
  free: boolean;
  freeAt: string[];
  highCost: boolean;
  priced: boolean;
}

export type PixKeyType = "cpf" | "phone" | "email" | "random";

export interface MonthShare {
  memberId: string;
  name: string;
  amountCents: number;
  /** Buys the medicines and receives the others' shares. */
  isReceiver: boolean;
  paid: boolean;
  paidAt: string | null;
  /** Pix "copia e cola" to pay the receiver; null for the receiver or without a key. */
  pix: string | null;
}

/** GET /family/month: savings, cost, split and doses of the current month. */
export interface MonthSummary {
  month: string;
  /** "novembro de 2026" */
  label: string;
  savedCents: number;
  costCents: number;
  highCostPotentialCents: number;
  saved: MonthItem[];
  toBuy: MonthItem[];
  /** Medicines to buy without a price. */
  unpriced: number;
  /** "2026-11-09": publication date of the CMED list the prices come from. */
  priceListDate: string | null;
  split: {
    receiver: { id: string; name: string; keyType: PixKeyType; pixKey: string } | null;
    /** The demo family: its Pix key is fictitious. */
    demoPix: boolean;
    shares: MonthShare[];
  };
  doses: { total: number; taken: number; missed: number; pending: number; byVoice: number };
}

export async function getMonth(): Promise<MonthSummary> {
  const res = await fetch(`${API_URL}${withFamily("/family/month")}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** Marks a caregiver's share of this month as paid or not. */
export async function setSharePaid(memberId: string, paid: boolean): Promise<void> {
  await send("PUT", withFamily(`/family/shares/${memberId}/paid`), { paid }, "Não deu para salvar.");
}

/** Saves who receives the Pix (null removes the key). */
export async function setPixKey(memberId: string, pix: { type: PixKeyType; key: string } | null): Promise<void> {
  await send("PUT", withFamily(`/family/members/${memberId}/pix`), { pix }, "Não deu para salvar a chave Pix.");
}

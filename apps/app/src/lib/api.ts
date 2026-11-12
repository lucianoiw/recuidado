import { authHeader, setSession } from "./session";
import { setMe, clearMe } from "./me";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** fetch to the API with this screen's login (caregiver session or patient link). */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: { ...authHeader(), ...(init.headers as Record<string, string> | undefined) },
  });
}

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
  const res = await apiFetch(`/family/medications/${medicationId}/high-cost`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Não deu para abrir o caminho do Alto Custo."));
  return res.json();
}

export async function saveHighCost(
  medicationId: string,
  body: { checked?: string[]; lmeFilledOn?: string | null; since?: string | null },
): Promise<void> {
  await send("PUT", `/family/medications/${medicationId}/high-cost`, body, "Não deu para salvar.");
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
  /** E-mails Resend accepted for this alert. */
  emailsDelivered: number;
  createdAt: string;
}

/** Alerts sent to the family, newest first. */
export async function getAlerts(): Promise<FamilyAlert[]> {
  const res = await apiFetch("/family/alerts", { cache: "no-store" });
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
  const res = await apiFetch("/family", { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function confirmDose(doseId: string): Promise<void> {
  const res = await apiFetch(`/doses/${doseId}/confirm`, { method: "POST" });
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
  const res = await apiFetch("/prescriptions/parse", { method: "POST", body: form });
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
  const res = await apiFetch(`/prescriptions/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ patientId, items }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Não deu para salvar."));
}

async function send(method: string, path: string, body: unknown, fallback: string): Promise<Response> {
  const res = await apiFetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await errorMessage(res, fallback));
  return res;
}

/** The caregiver phoned when she reports an emergency on the call; the others get only the push. */
export async function setEmergencyContact(memberId: string): Promise<void> {
  await send("PUT", `/family/members/${memberId}/emergency-contact`, {}, "Não deu para salvar o primeiro contato.");
}

/** "Pegar grátis" (buy = false) or "Comprar" (buy = true). */
export async function setBuyChoice(medicationId: string, buy: boolean): Promise<void> {
  await send("PUT", `/family/medications/${medicationId}/buy-choice`, { buy }, "Não deu para salvar.");
}

/** The signed-in caregiver. memberId and familyId are null until the sign-up is saved. */
export interface Me {
  email: string;
  memberId: string | null;
  name: string | null;
  familyId: string | null;
}

/** Sends the e-mail with the 6 digit code and the sign-in link. */
export async function startSignIn(email: string): Promise<void> {
  await send("POST", "/auth/start", { email }, "Não deu para enviar o código.");
}

/** Code typed in the app, or the token of the link in the e-mail. Keeps the session on this device. */
export async function verifySignIn(body: { email: string; code: string } | { link: string }): Promise<Me> {
  const res = await send("POST", "/auth/verify", body, "Não deu para entrar.");
  const { token, me } = (await res.json()) as { token: string; me: Me };
  setSession(token);
  if (me.memberId) setMe(me.memberId);
  else clearMe();
  return me;
}

/** Null when the session is missing or expired (and then it is forgotten). */
export async function getMe(): Promise<Me | null> {
  const res = await apiFetch("/auth/me");
  if (res.status === 401) {
    setSession(null);
    clearMe();
    return null;
  }
  if (!res.ok) throw new Error(`API ${res.status}`);
  const me = (await res.json()) as Me;
  if (me.memberId) setMe(me.memberId);
  return me;
}

export async function signOut(): Promise<void> {
  await apiFetch("/auth/sign-out", { method: "POST" }).catch(() => {});
  setSession(null);
  clearMe();
}

/** Invite shared by WhatsApp: the signed-in person takes the pending invite with their name. */
export async function claimInvite(familyId: string, name: string): Promise<Me> {
  const res = await send("POST", "/auth/claim-invite", { familyId, name }, "Não deu para entrar na família.");
  const me = (await res.json()) as Me;
  if (me.memberId) setMe(me.memberId);
  return me;
}

/** Secret of the link that opens her app without sign-up. `renew` makes a new one; the old stops working. */
export async function getPatientLink(renew = false): Promise<string> {
  const res = await send("POST", "/family/patient-link", { renew }, "Não deu para gerar o link dela.");
  return ((await res.json()) as { token: string }).token;
}

/** Sign-up answers as the API stores them: phone and CEP in digits, birth as aaaa-mm-dd. */
export interface OnboardingRecord {
  familyId: string;
  caregiverId: string;
  caregiver: { name: string; phone: string; email?: string; relation: string | null; relationOther: string };
  patient: { name: string; nickname: string; gender: "female" | "male"; phone: string; birth: string; cep: string; usesPhone: boolean; consent: boolean };
  invites: { id: string; name: string; relation: string | null; phone?: string; email?: string; joined: boolean }[];
}

/** The signed-in caregiver's sign-up, or null before the first save. */
export async function getOnboarding(): Promise<OnboardingRecord | null> {
  const res = await apiFetch("/family/onboarding");
  if (res.status === 404 || res.status === 401) return null;
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as OnboardingRecord;
}

/** Saves the sign-up of the signed-in caregiver. The first save creates the family. */
export async function saveOnboarding(body: unknown): Promise<{ caregiverId: string; familyId: string }> {
  const res = await send("PUT", "/family/onboarding", body, "Não deu para salvar o cadastro.");
  const saved = (await res.json()) as { caregiverId: string; familyId: string };
  setMe(saved.caregiverId);
  return saved;
}

/** Family edits the dose text or the times of a medication. */
export async function updateMedication(
  id: string,
  body: { strength?: string | null; times?: string[]; stockUnits?: number | null },
): Promise<void> {
  await send("PATCH", `/family/medications/${id}`, body, "Não deu para salvar a mudança.");
}

/** Family stops a medication. */
export async function removeMedication(id: string): Promise<void> {
  const res = await apiFetch(`/family/medications/${id}`, { method: "DELETE" });
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
  const res = await apiFetch(`/demo/run`, { method: "POST" });
  if (!res.ok) throw new Error(await errorMessage(res, "Não deu para começar a demo."));
  return res.json();
}

export async function getDemoRun(doseId: string): Promise<DemoRun> {
  const res = await apiFetch(`/demo/run/${doseId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** The patient accepts (or takes back) reminders, calls and the family seeing her doses. */
export async function setConsent(patientId: string, accepted: boolean): Promise<void> {
  await send("PUT", `/privacy/consent/${patientId}`, { accepted }, "Não deu para salvar a sua resposta.");
}

/** Downloads everything stored about the family of the signed-in caregiver (JSON file). */
export async function downloadFamilyData(): Promise<void> {
  const res = await apiFetch("/privacy/export");
  if (!res.ok) throw new Error(await errorMessage(res, "Não deu para baixar os dados."));
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "recuidado-dados.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Deletes the family of the signed-in caregiver and everything under it, then signs out. */
export async function deleteFamilyData(): Promise<void> {
  const res = await apiFetch("/privacy/family", { method: "DELETE" });
  if (!res.ok) throw new Error(await errorMessage(res, "Não deu para apagar os dados."));
  await signOut();
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

/** One round of pharmacy calls: the same medicines asked to each pharmacy at the same time. */
export interface PharmacyRound {
  inquiry: PharmacyInquiry | null;
  inquiries: PharmacyInquiry[];
}

/** "Perguntar às farmácias": the voice agent calls the pharmacies about these medicines. */
export async function askPharmacy(medicationIds: string[]): Promise<PharmacyRound> {
  const res = await send("POST", "/pharmacy-inquiries", { medicationIds }, "Não deu para ligar agora.");
  return res.json();
}

/** The family's most recent round of pharmacy calls. */
export async function getLatestPharmacyInquiry(): Promise<PharmacyRound> {
  const res = await apiFetch("/pharmacy-inquiries/latest", { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const body = (await res.json()) as Partial<PharmacyRound>;
  return { inquiry: body.inquiry ?? null, inquiries: body.inquiries ?? (body.inquiry ? [body.inquiry] : []) };
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
  const res = await apiFetch("/family/month", { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** Marks a caregiver's share of this month as paid or not. */
export async function setSharePaid(memberId: string, paid: boolean): Promise<void> {
  await send("PUT", `/family/shares/${memberId}/paid`, { paid }, "Não deu para salvar.");
}

/** Saves who receives the Pix (null removes the key). */
export async function setPixKey(memberId: string, pix: { type: PixKeyType; key: string } | null): Promise<void> {
  await send("PUT", `/family/members/${memberId}/pix`, { pix }, "Não deu para salvar a chave Pix.");
}

export interface Plan {
  name: string;
  priceCents: number;
  trialDays: number;
  /** AbacatePay is configured on the server. */
  available: boolean;
  isDemo: boolean;
  /** null: free plan. */
  status: "pending" | "active" | "cancelled" | null;
  trialEndsAt: string | null;
}

export async function getPlan(): Promise<Plan> {
  const res = await apiFetch("/family/plan", { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** Opens the AbacatePay checkout of the paid plan; returns its URL. */
export async function startPlanCheckout(): Promise<string> {
  const res = await send("POST", "/family/plan/checkout", {}, "Não deu para abrir o pagamento.");
  return ((await res.json()) as { url: string }).url;
}

export async function cancelPlan(): Promise<void> {
  await send("POST", "/family/plan/cancel", {}, "Não deu para cancelar.");
}

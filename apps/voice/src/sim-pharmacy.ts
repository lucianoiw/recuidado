import { greetingFor, type Medication } from "./prompt.js";

/**
 * Simulated pharmacies on the test Asterisk (deploy/asterisk, [sim-attendant]). The menu is a real
 * phone menu there; the attendant is a second GPT-Live session with another voice ("the actor"),
 * dialed together with the pharmacy call. No real pharmacy is called. Data is synthetic.
 */
export interface SimPharmacy {
  index: 1 | 2 | 3;
  name: string;
  attendant: string;
  /** Box price against the CMED ceiling (PMC) of the medicine. Above 1 is above the ceiling, which the app flags. */
  priceFactor: number;
  /** 0-based position of a medicine this pharmacy does not have in stock, if any. */
  outOfStock?: number;
}

export const SIM_PHARMACIES: SimPharmacy[] = [
  { index: 1, name: "Drogaria Vida", attendant: "Rafael", priceFactor: 0.9, outOfStock: 2 },
  { index: 2, name: "Farmácia Central", attendant: "Marcos", priceFactor: 0.65 },
  { index: 3, name: "Drogaria Bom Preço", attendant: "Paulo", priceFactor: 1.15, outOfStock: 1 },
];

/** A medicine as the actor knows it: the CMED box the API sent, when there is one. */
export interface SimMedication extends Medication {
  refPackCents?: number;
  unitsPerPack?: number;
}

/** +550000000001N is simulated pharmacy N. */
export function simPharmacyFor(e164: string): SimPharmacy | undefined {
  const m = /^\+550000000001([1-3])$/.exec(e164);
  return m ? SIM_PHARMACIES[Number(m[1]) - 1] : undefined;
}

/** The number the actor dials; Asterisk keeps it ringing until the caller reaches the attendant. */
export function actorNumber(p: SimPharmacy): string {
  return `+550000000009${p.index}`;
}

/** Stable pseudo price when the API sent no CMED reference: R$ 19 to R$ 59. */
function fallbackCents(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 1900 + (h % 4000);
}

/** The box price this pharmacy says, ending in ,90 like a shelf price. */
export function simPriceCents(p: SimPharmacy, m: SimMedication): number {
  const base = m.refPackCents && m.refPackCents > 0 ? m.refPackCents : fallbackCents(m.name);
  return Math.max(490, Math.round((base * p.priceFactor) / 100) * 100 - 10);
}

/** The reference brand costs about 1.8 times the generic, also ending in ,90. */
export function simReferenceCents(genericCents: number): number {
  return Math.round((genericCents * 1.8) / 100) * 100 - 10;
}

function reais(cents: number): string {
  return `R$ ${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

function spoken(m: Medication): string {
  return m.dose ? `${m.name} ${m.dose}` : m.name;
}

/** What the attendant knows, one line per medicine. */
export function simFacts(p: SimPharmacy, meds: SimMedication[]): string[] {
  return meds.map((m, i) => {
    if (p.outOfStock === i && meds.length > 1) return `${spoken(m)}: está em falta, não tem hoje.`;
    const units = m.unitsPerPack ?? 30;
    const generic = simPriceCents(p, m);
    return `${spoken(m)}: tem o genérico por ${reais(generic)} e o de referência por ${reais(simReferenceCents(generic))}, caixa com ${units} comprimidos.`;
  });
}

/** The actor's greeting when it picks up. */
export function simGreeting(p: SimPharmacy, now: Date = new Date()): string {
  return `${p.name}, ${greetingFor(now)}, ${p.attendant} falando.`;
}

/** Instructions for the actor: a pharmacy counter attendant on the phone, in Brazilian Portuguese. */
export function buildActorInstructions(p: SimPharmacy, meds: SimMedication[], now: Date = new Date()): string {
  return [
    `You are ${p.attendant}, a counter attendant at ${p.name}, a neighborhood pharmacy in São Paulo, answering the phone. This is a demonstration line with synthetic data.`,
    "Speak only Brazilian Portuguese, short and natural, like a friendly attendant on a busy afternoon. One or two sentences at a time.",
    `When the call connects, say: "${simGreeting(p, now)}" Then listen.`,
    "The caller is a virtual assistant asking about medicines for a family. Answer its questions using only these facts:",
    ...simFacts(p, meds).map((f) => `- ${f}`),
    "Say prices the way people say them on the phone (\"dezesseis e noventa\"). Give each answer when asked; you may give the price and box size together. If asked only for one price, give the generic first and the reference when asked.",
    "For any medicine not listed, say you need to check and do not have it now. Do not invent other prices or products.",
    "Never ask for or accept personal data, never sell or reserve anything, and never give advice about treatment or doses.",
    "If the caller says goodbye, answer \"Por nada, tchau!\" and then stay silent.",
  ].join("\n");
}

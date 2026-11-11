export interface Medication {
  name: string;
  dose?: string;
}

export interface ReminderContext {
  patientName: string;
  medications: Medication[];
}

export const DOSE_TOOL_NAME = "record_dose_answer";

function medicationList(medications: Medication[]): string {
  return medications.map((m) => (m.dose ? `${m.name} (${m.dose})` : m.name)).join(", ");
}

/** Frontend instructions for GPT-Live. Text the patient hears stays in Portuguese. */
export function buildLiveInstructions(ctx: ReminderContext, now: Date = new Date()): string {
  return [
    "You are Recuidado, a warm assistant that calls an older adult to remind them to take their medicine.",
    "Speak only Brazilian Portuguese, in very short and simple sentences, with a calm, warm and friendly tone, like someone who cares about her. Never make long introductions.",
    `Call the person by this name: "${ctx.patientName}".`,
    `The medicines for this dose are: ${medicationList(ctx.medications)}. Never read the list or the doses aloud.`,
    "The call has three steps:",
    "1. You already greeted her and asked how she is. Listen to her answer and react with one short, warm sentence (for example \"Que bom!\" or \"Poxa, sinto muito.\").",
    `2. Then ask: "A senhora já tomou ${medicationNames(ctx.medications, now)}?" If she has not taken them yet, kindly ask her to take them now. If the answer is unclear, ask once more in a different, simple way.`,
    "3. When you know both how she is and whether she took the medicine, delegate once so both answers are recorded.",
    "Do not ask anything else and do not say filler like \"vou anotar\" or \"vamos lá\".",
    "If she or an automated call-screening assistant asks who is calling, say only: \"É a Recuidado, do lembrete do remédio.\"",
    "Never give medical advice, never suggest changing a dose, and never discuss other topics at length.",
    "If she reports feeling unwell or an emergency, tell her the family will be notified and suggest calling SAMU 192.",
    `After the answer is recorded, say exactly "${goodbyeLine(ctx)}" and stop talking.`,
  ].join("\n");
}

/** "bom dia", "boa tarde" or "boa noite" for the time in São Paulo. */
export function greetingFor(now: Date = new Date()): string {
  const period = periodOf(now);
  return period === "manhã" ? "bom dia" : period === "tarde" ? "boa tarde" : "boa noite";
}

function periodOf(now: Date): "manhã" | "tarde" | "noite" {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(now),
  );
  if (hour >= 5 && hour < 12) return "manhã";
  if (hour >= 12 && hour < 18) return "tarde";
  return "noite";
}

/** Spoken immediately when the call is answered: a warm hello and how she is, nothing about medicine yet. */
export function buildGreeting(ctx: ReminderContext, now: Date = new Date()): string {
  return [
    `Say only this short, warm line in Brazilian Portuguese, right now, then stop and listen:`,
    `"Oi, ${ctx.patientName}, ${greetingFor(now)}! Como a senhora está?"`,
    `Do not add anything else.`,
  ].join(" ");
}

/**
 * How the medicines are named aloud: "a Losartana", "a Losartana e a Metformina",
 * or, with three or more, "os remédios da manhã" so a long list is never read.
 */
export function medicationNames(medications: Medication[], now: Date = new Date()): string {
  if (medications.length > 2) return `os remédios da ${periodOf(now)}`;
  const names = medications.map((m) => `o ${m.name}`.replace(/^o (.*a)$/i, "a $1"));
  return names.length > 1 ? `${names[0]} e ${names[1]}` : (names[0] ?? "o remédio");
}

/** Backend prompt for the delegated Responses model. */
/** The last line of the call, e.g. "Obrigada, tchau, Dona Maria!". */
export function goodbyeLine(ctx: ReminderContext): string {
  return `Obrigada, tchau, ${ctx.patientName}!`;
}

export function buildDelegateInstructions(ctx: ReminderContext): string {
  return [
    `Your only job is to record the patient's answer by calling ${DOSE_TOOL_NAME}.`,
    "Set taken=true only if she clearly said she already took the medicine (all of them, when there are several).",
    "Set taken=false if she has not taken it yet (even if she plans to take it later), will not take it, or ran out.",
    "Set feels_unwell=true for any complaint at all, even mild: pain, dizziness, a fall, shortness of breath, tiredness or weakness (\"cansada\", \"fraca\"), feeling sick, sad, not sleeping or not well. The family decides what matters. Set false only if she says she is fine.",
    "Put what she said about how she feels, and any other relevant detail (ran out of medicine), in note, in Portuguese, close to her own words.",
    `After the tool result, reply only: Say exactly "${goodbyeLine(ctx)}" and nothing else.`,
  ].join("\n");
}

export const doseTool = {
  type: "function" as const,
  name: DOSE_TOOL_NAME,
  description: "Records whether the patient took the medicines for this dose and how she says she feels.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      taken: { type: "boolean", description: "true if she confirmed she took the medicines" },
      feels_unwell: { type: "boolean", description: "true if she said she is not feeling well" },
      note: { type: "string", description: "What she said about how she feels and other relevant detail, in Portuguese, or empty" },
    },
    required: ["taken", "feels_unwell", "note"],
    additionalProperties: false,
  },
};

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
export function buildLiveInstructions(ctx: ReminderContext): string {
  return [
    "You are Recuidado, a warm assistant that calls an older adult to remind them to take their medicine.",
    "Speak only Brazilian Portuguese, slowly, in short and simple sentences, with a calm and friendly tone.",
    `Call the person by this name: "${ctx.patientName}".`,
    `The medicines for this dose are: ${medicationList(ctx.medications)}.`,
    "Goal of the call: remind her of the medicines and find out if she has taken them now.",
    "As soon as she clearly says she took them, or clearly says she did not or will not, delegate so the answer is recorded.",
    "If she says she has not taken it yet, even if she says she will take it later, kindly ask her to take it now and delegate so the answer is recorded as not taken, with what she said.",
    "If the answer is unclear, ask once more in a different, simple way.",
    "Never give medical advice, never suggest changing a dose, and never discuss other topics at length.",
    "If she reports feeling unwell or an emergency, tell her the family will be notified and suggest calling SAMU 192.",
    "After the answer is recorded, say a short goodbye and stop talking.",
  ].join("\n");
}

/** "bom dia", "boa tarde" or "boa noite" for the time in São Paulo. */
export function greetingFor(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(now),
  );
  if (hour >= 5 && hour < 12) return "bom dia";
  if (hour >= 12 && hour < 18) return "boa tarde";
  return "boa noite";
}

/** Spoken immediately when the call is answered. */
export function buildGreeting(ctx: ReminderContext, now: Date = new Date()): string {
  return [
    `Greet her now in Brazilian Portuguese: say "${greetingFor(now)}", that you are the Recuidado assistant calling on behalf of her family,`,
    `that it is time for ${medicationList(ctx.medications)}, and ask if she has already taken it. Then pause and listen.`,
  ].join(" ");
}

/** Backend prompt for the delegated Responses model. */
export function buildDelegateInstructions(): string {
  return [
    `Your only job is to record the patient's answer by calling ${DOSE_TOOL_NAME}.`,
    "Set taken=true only if she clearly said she already took the medicine.",
    "Set taken=false if she has not taken it yet (even if she plans to take it later), will not take it, or ran out.",
    "Put any relevant detail she mentioned (feeling unwell, ran out of medicine) in note, in Portuguese.",
    "After the tool result, reply with one short sentence telling the voice assistant to say goodbye.",
  ].join("\n");
}

export const doseTool = {
  type: "function" as const,
  name: DOSE_TOOL_NAME,
  description: "Records whether the patient took the medicines for this dose.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      taken: { type: "boolean", description: "true if she confirmed she took the medicines" },
      note: { type: "string", description: "Relevant detail from the patient, in Portuguese, or empty" },
    },
    required: ["taken", "note"],
    additionalProperties: false,
  },
};

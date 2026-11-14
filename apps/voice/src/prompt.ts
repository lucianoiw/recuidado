export interface Medication {
  name: string;
  dose?: string;
}

export interface ReminderContext {
  patientName: string;
  medications: Medication[];
  /** Call back a few minutes after she reported an emergency: only ask how she is now. */
  checkIn?: boolean;
  /** On a call back: whether Recuidado will call her again if she is still not well. */
  callBack?: boolean;
  /** "a senhora" (female, default) or "o senhor" (male). */
  gender?: "female" | "male";
  /** Scheduled time of the dose (ISO), said as "das duas da tarde". */
  doseTime?: string;
  /** Second call, some minutes after she said she had not taken it yet: only ask whether she took it. */
  recall?: boolean;
  /** First call: whether Recuidado calls again to confirm if she has not taken it yet. */
  recallLater?: boolean;
}

/** "a senhora" / "o senhor", "ela" / "ele" and the other words that change with the patient's gender. */
export function pronouns(ctx: Pick<ReminderContext, "gender">) {
  const male = ctx.gender === "male";
  return {
    you: male ? "o senhor" : "a senhora",
    You: male ? "O senhor" : "A senhora",
    she: male ? "he" : "she",
    She: male ? "He" : "She",
    her: male ? "him" : "her",
  };
}

export const DOSE_TOOL_NAME = "record_dose_answer";

function medicationList(medications: Medication[]): string {
  return medications.map((m) => (m.dose ? `${m.name} (${m.dose})` : m.name)).join(", ");
}

/**
 * Frontend instructions for GPT-Live, in the structure of OpenAI's GPT-Live prompting guide (role, goal,
 * backchannel, interruption and delegation policies). It gives the call a goal, not lines to read: the model
 * talks in its own words, and our code never dictates a sentence. Text she hears stays in Portuguese.
 */
export function buildLiveInstructions(ctx: ReminderContext, now: Date = new Date()): string {
  if (ctx.checkIn) return buildCheckInInstructions(ctx);
  const p = pronouns(ctx);
  const ask = medicationQuestion(ctx, now);
  const notTakenEnd = ctx.recall
    ? `there is no other call today: kindly remind ${p.her} to take it and say the family will be told`
    : ctx.recallLater === false
      ? `kindly remind ${p.her} to take it and say the family will be told`
      : `say you will call again in a little while to check`;
  const opening = ctx.recall
    ? `You already greeted ${p.her}, said you are calling again, and asked: "${ask}". Listen to the answer.`
    : `You already greeted ${p.her}, said you are Recuidado's virtual assistant, and asked how ${p.she} is. Listen to the answer.`;
  return [
    `You are the virtual assistant of Recuidado, calling ${ctx.patientName} on the phone. Recuidado helps the family take care of ${p.her} medicine.`,
    `Speak Brazilian Portuguese like a kind, patient person who cares about ${p.her}: warm, natural and unhurried, with short, simple sentences. Talk in your own words and react to what ${p.she} says, like a real conversation. Never sound like a form or a recording.`,
    `Call ${p.her} "${ctx.patientName}" and "${p.you}".`,
    "",
    "Goal of the call (in a natural order, not as a script):",
    `- ${opening}`,
    `- Know how ${p.she} is today.`,
    `- Know whether ${p.she} already took the medicine of this dose. Ask in a natural way, for example: "${ask}" The medicines are: ${medicationList(ctx.medications)}. Do not read the doses aloud. Say "remédio", never "medicamento".`,
    `- If ${p.she} has not taken it yet, gently ask if ${p.she} can take it now. If ${p.she} goes to take it and says ${p.she} took it, that counts. If ${p.she} cannot or will not take it now, do not insist: ${notTakenEnd}.`,
    `- If ${p.she} says ${p.she} is not feeling well, show you care in a few words and say the family will be told. Never give health advice or tell ${p.her} what to do. If ${p.she} is fine, do not talk about telling the family.`,
    `- A possible emergency (a fall, chest pain, shortness of breath, fainting, too weak to stand up): do not ask about the medicine. Stay calm and kind, say you will tell the family right now and call ${p.her} back in a few minutes, and end the call so ${p.her} line is free for the family.`,
    `- When the goal is done, say goodbye warmly in your own words, with "tchau". If ${p.she} wants to chat a little, chat briefly and kindly, then say goodbye.`,
    "",
    `Never invent anything: no facts about ${p.her} health, medicines, family or appointments that you were not told, and no promises other than the ones above. If ${p.she} asks something you do not know, say you do not know and that the family can help.`,
    `If ${p.she} asks whether you are a person, say honestly that you are a virtual assistant. If ${p.she} does not want these calls, say you will tell the family.`,
    `If an automated call-screening assistant answers, say: "É a Recuidado, lembrete do remédio da ${ctx.patientName}."`,
    "",
    `Backchannel policy: Do not produce any backchannel interjections while ${p.she} is speaking. Stay silent until it is your turn. Use only words: never hum, sing, sigh, laugh or make other sounds.`,
    "",
    `Interruption policy: Stop speaking when ${p.she} interrupts. Listen to what ${p.she} says, then answer that.`,
    "",
    "Delegation policy:",
    "Backend tools:",
    "- Record the call: saves whether the medicine was taken, how she feels, and any emergency, so the family is told.",
    "Generate <|SpawnThinking|> when (it can run more than once; the last one counts):",
    `- ${p.She} says whether ${p.she} took the medicine, that ${p.she} has not, or that ${p.she} just took it during the call.`,
    `- ${p.She} says how ${p.she} feels, or reports a possible emergency (right away).`,
    `- You are about to say goodbye and have not generated it since ${p.she} last said something about the medicine or how ${p.she} feels.`,
    "Do not generate <|SpawnThinking|> when:",
    "- You are only greeting or chatting.",
    "Never mention the recording, never wait for its result, and never repeat what the backend says.",
  ].join("\n");
}

/** The call back after an emergency: how is she now. Nothing about the medicine. */
function buildCheckInInstructions(ctx: ReminderContext): string {
  const p = pronouns(ctx);
  return [
    `You are the virtual assistant of Recuidado, calling ${ctx.patientName} back. A few minutes ago ${p.she} said on the phone that ${p.she} might need help, and the family was told.`,
    `Speak Brazilian Portuguese like a kind, calm person who cares about ${p.her}: natural, short and simple sentences, in your own words.`,
    `Call ${p.her} "${ctx.patientName}" and "${p.you}".`,
    "",
    "Goal of the call:",
    `- You already greeted ${p.her} and asked if ${p.she} is better. Listen to the answer.`,
    `- If ${p.she} is better or someone from the family is with ${p.her}, say you are glad in your own words and say goodbye warmly, with "tchau".`,
    `- If ${p.she} is still not well, stay calm and kind, say you will tell the family again${ctx.callBack === false ? "" : ` and call ${p.her} back soon`}, and say goodbye.`,
    "- Do not ask about the medicine. Never give health advice or tell her what to do. Never invent anything.",
    "",
    `Backchannel policy: Do not produce any backchannel interjections while ${p.she} is speaking. Use only words: never hum, sing, sigh, laugh or make other sounds.`,
    "",
    `Interruption policy: Stop speaking when ${p.she} interrupts. Listen to what ${p.she} says, then answer that.`,
    "",
    "Delegation policy:",
    "Backend tools:",
    "- Record the call back: saves how she is now, so the family is told.",
    "Generate <|SpawnThinking|> when:",
    `- ${p.She} has said how ${p.she} is now.`,
    "Do not generate <|SpawnThinking|> when:",
    "- You are only greeting or saying goodbye.",
    "Never mention the recording, never wait for its result, and never repeat what the backend says.",
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

/** The first line she hears: a warm hello, that it is a virtual assistant, and how she is. */
export function greetingLine(ctx: ReminderContext, now: Date = new Date()): string {
  const p = pronouns(ctx);
  // The AI says it is an AI before anything else (transparency, LGPD art. 9 and art. 20).
  if (ctx.checkIn) {
    return `Oi, ${ctx.patientName}! É a assistente virtual da Recuidado de novo. ${p.You} está melhor?`;
  }
  if (ctx.recall) {
    return `Oi, ${ctx.patientName}! É a assistente virtual da Recuidado de novo. ${medicationQuestion(ctx, now)}`;
  }
  return `Oi, ${ctx.patientName}, ${greetingFor(now)}! Aqui é a assistente virtual da Recuidado. Como ${p.you} está?`;
}

/** "A senhora já tomou a Losartana das duas da tarde?" */
export function medicationQuestion(ctx: ReminderContext, now: Date = new Date()): string {
  const at = ctx.doseTime ? new Date(ctx.doseTime) : undefined;
  const when = at && !Number.isNaN(at.getTime()) ? ` ${spokenTime(at)}` : "";
  return `${pronouns(ctx).You} já tomou ${medicationNames(ctx.medications, at ?? now, Boolean(when))}${when}?`;
}

const HOURS = ["meia-noite", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "meio-dia"];

/** The dose time as people say it: "das duas da tarde", "da uma e meia da tarde", "do meio-dia". */
export function spokenTime(at: Date): string {
  const [h, m] = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" })
    .format(at)
    .split(":")
    .map(Number);
  const minutes = m === 0 ? "" : m === 30 ? " e meia" : ` e ${m}`;
  if (h === 0) return `da meia-noite${minutes}`;
  if (h === 12) return `do meio-dia${minutes}`;
  const hour = HOURS[h % 12];
  const period = h < 5 ? "da madrugada" : h < 12 ? "da manhã" : h < 18 ? "da tarde" : "da noite";
  return `${h % 12 === 1 ? "da" : "das"} ${hour}${minutes} ${period}`;
}

/** Spoken immediately when the call is answered: a warm hello and how she is, nothing about medicine yet. */
export function buildGreeting(ctx: ReminderContext, now: Date = new Date()): string {
  return [
    `Say only this short, warm line in Brazilian Portuguese, right now, then stop and listen:`,
    `"${greetingLine(ctx, now)}"`,
    `Do not add anything else.`,
  ].join(" ");
}

/** Used instead of buildGreeting when a recording of the greeting plays as the call is answered. */
export function buildRecordedGreetingNote(line: string): string {
  return `When the call is answered, a recording of you saying "${line}" plays first. Do not say the greeting yourself. After it, listen to her answer.`;
}

/**
 * How the medicines are named aloud: "a Losartana", "a Losartana e a Metformina",
 * or, with three or more, "os remédios da manhã" ("os remédios" when the time is said) so a long list is never read.
 */
export function medicationNames(medications: Medication[], now: Date = new Date(), timed = false): string {
  if (medications.length > 2) return timed ? "os remédios" : `os remédios da ${periodOf(now)}`;
  const names = medications.map((m) => `o ${m.name}`.replace(/^o (.*a)$/i, "a $1"));
  return names.length > 1 ? `${names[0]} e ${names[1]}` : (names[0] ?? "o remédio");
}

/** Backend prompt for the delegated Responses model. */
export function buildDelegateInstructions(ctx: ReminderContext): string {
  if (ctx.checkIn) {
    return [
      `Your only job is to record how the patient is now by calling ${DOSE_TOOL_NAME}. This call is not about the medicine: set taken=false.`,
      "Set feels_unwell=false if she says she is better or that someone from the family is already with her (\"meu filho já veio\"). Set true only if she says she is still not well (pain, dizzy, cannot get up). Being unsure is not a complaint: if she has not said how she is yet, wait for it.",
      "Set emergency=true only if it is still a possible emergency: she fell and cannot get up, chest pain, shortness of breath, fainting, or she asks for urgent help.",
      "Put in note what she reported, in Portuguese, as a short phrase in the third person and without a subject, so that it completes the sentence \"ela falou que ...\". Examples: \"caiu no banheiro e está com dor no braço\", \"ainda está com dor\", \"está melhor e o filho já chegou\", \"já tomou o remédio\". Never quote her in the first person.",
      "After the tool result, reply only: Recorded. This is not for her: the voice goes on with the conversation in its own words.",
    ].join("\n");
  }
  return [
    `Your only job is to record the patient's answer by calling ${DOSE_TOOL_NAME}.`,
    "Set taken=true only if she clearly said she already took the medicine (all of them, when there are several).",
    "Set taken=false if she has not taken it yet (even if she plans to take it later), will not take it, or ran out.",
    "Set feels_unwell=true for any complaint at all, even mild: pain, dizziness, a fall, shortness of breath, tiredness or weakness (\"cansada\", \"fraca\"), feeling sick, sad, not sleeping or not well. The family decides what matters. Set false if she says she is fine, or if she gives no complaint at all (\"tô aguardando\", \"tô aqui\", \"normal\", a question back): only a complaint counts.",
    "Set emergency=true only for a possible emergency: a fall, chest pain, shortness of breath, fainting, too weak to stand up, or she asks for urgent help. The family gets a phone call. Tiredness alone is not an emergency. Otherwise false.",
    "Put in note what she reported, in Portuguese, as a short phrase in the third person and without a subject, so that it completes the sentence \"ela falou que ...\". Include how she feels and any other relevant detail (ran out of medicine). Examples: \"caiu no banheiro e está com dor no braço\", \"ainda está com dor\", \"está melhor e o filho já chegou\", \"já tomou o remédio\". Never quote her in the first person.",
    "After the tool result, reply only: Recorded. This is not for her: the voice goes on with the conversation in its own words.",
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
      emergency: {
        type: "boolean",
        description: "true only for a possible emergency: a fall, chest pain, shortness of breath, fainting, or she asks for urgent help",
      },
      note: { type: "string", description: "What she reported, in Portuguese, in the third person without a subject (\"caiu no banheiro\"), or empty" },
    },
    required: ["taken", "feels_unwell", "emergency", "note"],
    additionalProperties: false,
  },
};

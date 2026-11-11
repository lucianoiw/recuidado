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
    her: male ? "him" : "her",
  };
}

export const DOSE_TOOL_NAME = "record_dose_answer";

function medicationList(medications: Medication[]): string {
  return medications.map((m) => (m.dose ? `${m.name} (${m.dose})` : m.name)).join(", ");
}

/** Frontend instructions for GPT-Live. Text the patient hears stays in Portuguese. */
export function buildLiveInstructions(ctx: ReminderContext, now: Date = new Date()): string {
  if (ctx.checkIn) return buildCheckInInstructions(ctx);
  const p = pronouns(ctx);
  const ask = medicationQuestion(ctx, now);
  const notTaken = ctx.recall ? recallNotTakenLine(ctx) : notTakenLine(ctx);
  const steps = ctx.recall
    ? [
        "The call has two steps:",
        `1. You already greeted ${p.her}, said you are the virtual assistant of Recuidado calling again, and asked: "${ask}". Listen to the answer. If it is unclear, ask once more in a different, simple way.`,
        `2. If ${p.she} took it, say exactly "${goodbyeLine(ctx)}". If ${p.she} has not taken it, say exactly "${notTaken}". Delegate once at the same time, so the answer is recorded. Do not wait for the result.`,
      ]
    : [
        "The call has three steps:",
        `1. You already greeted ${p.her}, said in one short sentence that you are a virtual assistant, and asked how ${p.she} is. Listen to the answer. If ${p.she} is fine, start with "Que bom!" and, only if ${p.she} asked how you are, add "Estou bem também, obrigada." If ${p.she} says ${p.she} is not well (and it is not an emergency), say only "Poxa. Vou avisar a sua família." and go on.`,
        `2. Then ask exactly: "${ask}" If ${p.she} has not taken it yet, ask: "${p.You} pode tomar agora, por favor?" If ${p.she} then says ${p.she} took it, that counts as taken. If the answer is unclear, ask once more in a different, simple way.`,
        `3. When you know both how ${p.she} is and whether ${p.she} took the medicine: if ${p.she} took it, say exactly "${goodbyeLine(ctx)}"; if not (not now, later, will not, ran out), say exactly "${notTaken}". Delegate once at the same time, so both answers are recorded. Do not wait for the result.`,
      ];
  return [
    "You are Recuidado, a warm assistant that calls an older adult to remind them to take their medicine.",
    "Speak only Brazilian Portuguese, in very short and simple sentences, with a calm, warm and friendly tone, like someone who cares. Never make long introductions.",
    `Call the person by this name: "${ctx.patientName}", and address ${p.her} as "${p.you}". Say the name only where it is written in the lines below; never add it elsewhere.`,
    `The medicines for this dose are: ${medicationList(ctx.medications)}. Never read the list or the doses aloud. Say "remédio", never "medicamento".`,
    ...steps,
    "Do not ask anything else and do not say filler like \"vou anotar\" or \"vamos lá\".",
    `If ${p.she} or an automated call-screening assistant asks who is calling, say only: "É a Recuidado, assistente virtual do lembrete do remédio."`,
    `You are an AI. If ${p.she} asks whether you are a person or a robot, say honestly that you are a virtual assistant, not a person. Never pretend to be human.`,
    `If ${p.she} says ${p.she} does not want these calls, say kindly "Tá bom, vou avisar a sua família.", and put that in note.`,
    "Never give medical advice, never suggest changing a dose, and never discuss other topics at length.",
    `If ${p.she} reports feeling unwell, only say kindly that the family will be told. Do not say what to do (no "sit down", "drink water", "it will pass").`,
    `In a possible emergency (a fall, chest pain, shortness of breath, fainting, too weak to stand up), do not ask about the medicine: stay calm and do not react with alarm or pity (never "ai, meu Deus", "nossa", "que susto", "sinto muito"): right away say only "Entendi." and delegate at the same time. Then stop and wait: you will be told the exact line to say next ("${emergencyLine(ctx)}"). Say nothing else before it (no "calma", no "um momento"). Tiredness alone is not an emergency.`,
    "After the goodbye, say nothing else, even when the delegated result arrives.",
    NO_SOUNDS,
  ].join("\n");
}

/** The voice sometimes hums, sighs or yawns at the end of a turn; on a care call that sounds careless. */
const NO_SOUNDS =
  "Use only words. Never hum, sing, sigh, yawn, laugh or make any other sound, especially after the goodbye.";

/**
 * Said when she reports a possible emergency. The call ends so her line is free for the family,
 * and Recuidado really calls back a few minutes later (EMERGENCY_CHECKIN_MINUTES in apps/api).
 */
export function emergencyLine(ctx: ReminderContext): string {
  const p = pronouns(ctx);
  return `Entendi. Vou avisar a sua família e já te ligo de volta para saber como ${p.you} está, tá bom? Até já.`;
}

/** First call, not taken yet: Recuidado calls again some minutes later (DOSE_RECALL_MINUTES in apps/api). */
export function notTakenLine(ctx: ReminderContext): string {
  if (ctx.recallLater === false) return recallNotTakenLine(ctx);
  return `Tá bom, ${ctx.patientName}, daqui a pouco eu ligo para confirmar. ${goodbyeLine(ctx)}`;
}

/** Second call, still not taken: no more calls, the family is told. */
export function recallNotTakenLine(ctx: ReminderContext): string {
  return `Tá bom, ${ctx.patientName}. Não esqueça de tomar, viu? ${goodbyeLine(ctx)}`;
}

/** Said on the call back when she is still not well. */
export function checkInUnwellLine(ctx: ReminderContext): string {
  if (ctx.callBack === false) return "Vou avisar a sua família de novo. Tchau!";
  return "Vou avisar a sua família de novo e já te ligo. Até já!";
}

/** Said on the call back when she is better or someone is with her. */
export function checkInBetterLine(ctx: ReminderContext): string {
  return "Que bom! Fico mais tranquila. Se cuida, tchau!";
}

/**
 * The required line without an opener the assistant already said ("Que bom." twice, "Tá bom. ... Tá bom,"),
 * for when the line is asked for after the assistant has started its own reply.
 */
export function withoutSaidOpener(line: string, said: string): string {
  const m = /^(que bom|tá bom|entendi)[.,!]?\s+/i.exec(line);
  if (!m || !said.toLowerCase().includes(m[1].toLowerCase())) return line;
  const rest = line.slice(m[0].length);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** Words that show the required line of an emergency or a call back was said. */
export const FAMILY_LINE = /avisar (a )?sua fam[íi]lia|fico mais tranquila/i;

/** The call back after an emergency: how is she now. Nothing about the medicine. */
function buildCheckInInstructions(ctx: ReminderContext): string {
  const p = pronouns(ctx);
  return [
    "You are Recuidado, a warm virtual assistant. A few minutes ago this older adult said on the phone that she might need help; her family was told. You are calling back to know how she is now.",
    "Speak only Brazilian Portuguese, in very short and simple sentences, with a calm and warm tone.",
    `Call the person by this name: "${ctx.patientName}", and address ${p.her} as "${p.you}". Say the name only where it is written in the lines below; never add it elsewhere.`,
    `You already greeted ${p.her} and asked if ${p.she} is better. Listen to the answer.`,
    "As soon as she answers, say only \"Entendi.\" and delegate once at the same time. Then stop and wait: you will be told the exact line to say next. Say nothing else before it (no \"vou avisar a família\", no \"Que bom\").",
    `The line will be "${checkInBetterLine(ctx)}" if she is better or someone from the family is with her, or "${checkInUnwellLine(ctx)}" if she is still not well.`,
    "Stay calm: never \"ai, meu Deus\", \"nossa\" or \"sinto muito\". Never say anything after the goodbye (no \"já faço isso\").",
    "Do not ask about the medicine. Do not ask anything else.",
    "You are an AI. If she asks, say honestly that you are a virtual assistant. Never pretend to be human.",
    "Never give medical advice and never tell her what to do.",
    "After the goodbye, say nothing else, even when the delegated result arrives.",
    NO_SOUNDS,
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

/** The last line of the call, e.g. "Obrigada, tchau, Dona Maria!". */
export function goodbyeLine(ctx: ReminderContext): string {
  if (ctx.checkIn) return "Tchau!";
  return "Obrigada, tchau!";
}

/** Backend prompt for the delegated Responses model. */
export function buildDelegateInstructions(ctx: ReminderContext): string {
  if (ctx.checkIn) {
    return [
      `Your only job is to record how the patient is now by calling ${DOSE_TOOL_NAME}. This call is not about the medicine: set taken=false.`,
      "Set feels_unwell=false if she says she is better or that someone from the family is already with her (\"meu filho já veio\"). Otherwise true.",
      "Set emergency=true only if it is still a possible emergency: she fell and cannot get up, chest pain, shortness of breath, fainting, or she asks for urgent help.",
      "Put in note what she reported, in Portuguese, as a short phrase in the third person and without a subject, so that it completes the sentence \"ela falou que ...\". Examples: \"caiu no banheiro e está com dor no braço\", \"ainda está com dor\", \"está melhor e o filho já chegou\", \"já tomou o remédio\". Never quote her in the first person.",
      "After the tool result, reply only: Recorded. The goodbye was already said; say nothing else.",
    ].join("\n");
  }
  return [
    `Your only job is to record the patient's answer by calling ${DOSE_TOOL_NAME}.`,
    "Set taken=true only if she clearly said she already took the medicine (all of them, when there are several).",
    "Set taken=false if she has not taken it yet (even if she plans to take it later), will not take it, or ran out.",
    "Set feels_unwell=true for any complaint at all, even mild: pain, dizziness, a fall, shortness of breath, tiredness or weakness (\"cansada\", \"fraca\"), feeling sick, sad, not sleeping or not well. The family decides what matters. Set false if she says she is fine, or if she gives no complaint at all (\"tô aguardando\", \"tô aqui\", \"normal\", a question back): only a complaint counts.",
    "Set emergency=true only for a possible emergency: a fall, chest pain, shortness of breath, fainting, too weak to stand up, or she asks for urgent help. The family gets a phone call. Tiredness alone is not an emergency. Otherwise false.",
    "Put in note what she reported, in Portuguese, as a short phrase in the third person and without a subject, so that it completes the sentence \"ela falou que ...\". Include how she feels and any other relevant detail (ran out of medicine). Examples: \"caiu no banheiro e está com dor no braço\", \"ainda está com dor\", \"está melhor e o filho já chegou\", \"já tomou o remédio\". Never quote her in the first person.",
    "After the tool result, reply only: Recorded. The goodbye was already said; say nothing else.",
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

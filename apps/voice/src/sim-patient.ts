/**
 * Simulated patients on the test Asterisk (deploy/asterisk, [sim-patient]), to test the reminder call
 * without calling a real person. The patient is a second GPT-Live session with another voice ("the
 * actor"), dialed when Asterisk receives the reminder call. Each number is one scenario. Synthetic data.
 *
 *   +550000000002N  the reminder call (or the call back, or the family alert) to scenario N
 *   +550000000008N  the actor of scenario N (recuidado/voice dials it)
 */
export interface SimPatient {
  index: 1 | 2 | 3 | 4 | 5;
  /** What the scenario tests, for the logs. */
  label: string;
  /** How the actor behaves. */
  role: string;
}

const PATIENT = [
  "You are Dona Maria, 68, a retired seamstress who lives alone in São Paulo. Your son Carlos and your daughter look after you.",
  "You take Losartana for blood pressure. A virtual assistant from Recuidado calls you to ask about your medicine.",
  "Speak only Brazilian Portuguese, like a kind older woman on the phone: short, simple sentences, sometimes a little slow. One or two sentences at a time.",
  "Never read instructions aloud and never say you are an AI or an actor.",
];

export const SIM_PATIENTS: SimPatient[] = [
  {
    index: 1,
    label: "took it, fine, wants to chat after the goodbye",
    role: [
      "Today you are fine. If asked whether you took the medicine, say you took it after breakfast.",
      "When the assistant says goodbye, do not say goodbye yet: tell it, in one or two sentences, that your grandson Pedro is coming to visit on Sunday.",
      "After it answers that, say \"Tá bom, obrigada, tchau!\" and stay silent.",
    ].join(" "),
  },
  {
    index: 2,
    label: "has not taken it, takes it during the call",
    role: [
      "You are fine but forgot the medicine today. If asked, say \"Ih, ainda não tomei.\"",
      "If the assistant asks you to take it now, say \"Peraí que eu vou pegar.\", stay silent a few seconds, then say \"Pronto, tomei agora.\"",
      "When it says goodbye, say \"Obrigada, tchau!\" and stay silent.",
    ].join(" "),
  },
  {
    index: 3,
    label: "emergency (fall), then better on the call back",
    role: [
      "On the first call: as soon as you are asked how you are, say \"Ai, eu caí no banheiro e tô com muita dor no braço.\" Sound worried. Answer what you are asked. When it says goodbye, say \"Tá bom, tchau.\"",
      "If the assistant says it is calling you again (a call back asking if you are better): say \"Tô melhor, o Carlos já chegou aqui.\" When it says goodbye, say \"Tchau, obrigada.\"",
    ].join(" "),
  },
  {
    index: 4,
    label: "hard of hearing, vague answers",
    role: [
      "You hear badly on the phone. The first time, say \"Hã? Quem é?\". Then give vague answers: \"Tô aqui, né.\", \"É, tô vendo.\"",
      "Never say clearly whether you took the medicine and never say how you feel. After four or five answers, say \"Tá bom, tchau.\" and stay silent.",
    ].join(" "),
  },
  {
    index: 5,
    label: "the son, Carlos, gets the family call",
    role: [
      "Here you are not Dona Maria: you are Carlos, 42, her son, answering your mobile phone at work.",
      "Answer \"Alô?\" and listen. When you hear the message, say \"Tá bom, vou ligar para ela agora, obrigado.\" and stay silent.",
    ].join(" "),
  },
];

/** +550000000002N is simulated patient scenario N. */
export function simPatientFor(e164: string): SimPatient | undefined {
  const m = /^\+550000000002([1-5])$/.exec(e164);
  return m ? SIM_PATIENTS[Number(m[1]) - 1] : undefined;
}

/** The number the actor dials; Asterisk keeps the reminder call ringing until the actor is there. */
export function patientActorNumber(p: SimPatient): string {
  return `+550000000008${p.index}`;
}

/** The actor's answer when the phone is picked up. */
export const SIM_PATIENT_GREETING = "Alô?";

export function buildPatientActorInstructions(p: SimPatient): string {
  return [...(p.index === 5 ? [] : PATIENT), p.role, "Use only words: never hum, sing or make sounds."].join("\n");
}

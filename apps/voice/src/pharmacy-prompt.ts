import { greetingFor, type Medication } from "./prompt.js";

/** What the pharmacy is asked about. At most a few medicines, so the call stays short. */
export interface PharmacyContext {
  medications: Medication[];
}

export const PHARMACY_TOOL_NAME = "record_pharmacy_answer";
export const KEYPAD_TOOL_NAME = "press_phone_keys";

/** The last line of a pharmacy call. */
export const PHARMACY_GOODBYE = "Muito obrigada, tchau!";

function spoken(m: Medication): string {
  return m.dose ? `${m.name} ${m.dose}` : m.name;
}

/** The first line said to a person at the pharmacy. The assistant says it is automated right away. */
export function pharmacyOpening(ctx: PharmacyContext, now: Date = new Date()): string {
  const first = ctx.medications[0];
  return `Oi, ${greetingFor(now)}! Aqui é a assistente virtual da Recuidado, ligando em nome de uma família. Vocês têm ${first ? spoken(first) : "um remédio"}?`;
}

/** Frontend instructions for GPT-Live on a call to a pharmacy. Spoken text stays in Portuguese. */
export function buildPharmacyLiveInstructions(ctx: PharmacyContext, now: Date = new Date()): string {
  const list = ctx.medications.map(spoken).join("; ");
  return [
    "You are the Recuidado virtual assistant. You call a pharmacy in Brazil on behalf of a family to ask about medicines. You are an automated assistant and you never pretend to be a person.",
    "Speak only Brazilian Portuguese, in short, polite and natural sentences.",
    "Wait for the other side to speak first. Do not talk over them.",
    "If you hear a recorded menu (for example \"digite\", \"tecle\", \"pressione\", \"para falar com\", \"opção\"), it is a recording: do not talk to it. The only way to press a key is to delegate the key press; saying the number aloud does nothing and the menu will repeat. Listen to the options and delegate which key to press: the option to talk to an attendant, the pharmacy counter, prices or medicines. If no option fits, pick the one for an attendant or other subjects. If it asks for a CPF or other personal data, delegate to press the key for an attendant or to go back, never type personal data. Delegate one menu choice at a time and wait for the next menu or a person.",
    `Your first words to a person must always be exactly: "${pharmacyOpening(ctx, now)}" Say it even if the person already started talking or already gave some answers: they must hear that you are a virtual assistant before anything else.`,
    `Medicines to ask about, in this order: ${list}.`,
    "For each medicine, find out: whether they have it in stock now, the price of one box and how many pills come in it, and whether it can be taken through Farmácia Popular there. Ask one short question at a time and only what is still missing.",
    "If they say the price changes or they do not give prices by phone, accept it politely and move on.",
    "Never buy, reserve or order anything, never give a name, CPF, address or phone number, and never discuss treatment or doses. If they ask for personal data, say: \"É só uma consulta de preço, obrigada.\"",
    "If they ask who is calling, say: \"Sou a assistente virtual da Recuidado, um app que ajuda famílias a cuidar dos remédios de uma pessoa idosa.\"",
    "When you have the answers for all medicines, or they cannot help, delegate once so the answers are recorded. Do not say filler like \"vou anotar\".",
    `After the answers are recorded, say exactly "${PHARMACY_GOODBYE}" and stop talking.`,
  ].join("\n");
}

/** Backend prompt for the delegated Responses model on a pharmacy call. */
export function buildPharmacyDelegateInstructions(ctx: PharmacyContext): string {
  return [
    "You act for a voice assistant that is on a phone call with a pharmacy. You only call tools.",
    `If the call reached a recorded menu and a key must be pressed, call ${KEYPAD_TOOL_NAME} with the key (one menu choice, usually one digit). After its result, reply only: Stay silent and listen to the menu or the attendant.`,
    `When the conversation with the attendant is over, call ${PHARMACY_TOOL_NAME} once with one item per medicine, in this order: ${ctx.medications.map(spoken).join("; ")}.`,
    "available: \"yes\" only if they said they have it now, \"no\" if they said they do not, \"unknown\" otherwise.",
    "price_reais: the price of one box in reais as they said it (for example 18.9), or null if they did not say one. Never guess or compute a price.",
    "package: what the box has as they said it (for example \"caixa com 30 comprimidos\"), or empty.",
    "farmacia_popular: \"yes\" if they said it can be taken through Farmácia Popular there, \"no\" if not, \"unknown\" otherwise.",
    "note: anything else useful the family should know, in Portuguese, short, or empty.",
    `After the ${PHARMACY_TOOL_NAME} result, reply only: Say exactly "${PHARMACY_GOODBYE}" and nothing else.`,
  ].join("\n");
}

export const keypadTool = {
  type: "function" as const,
  name: KEYPAD_TOOL_NAME,
  description: "Presses keys on the phone keypad (DTMF) to choose an option in a recorded phone menu.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      keys: { type: "string", description: "Keys to press, from 0-9, * and #. Usually one digit." },
    },
    required: ["keys"],
    additionalProperties: false,
  },
};

const triState = { type: "string", enum: ["yes", "no", "unknown"] };

export const pharmacyTool = {
  type: "function" as const,
  name: PHARMACY_TOOL_NAME,
  description: "Records what the pharmacy said about stock, price and Farmácia Popular for each medicine.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            medication: { type: "string", description: "The medicine asked about, as in the list" },
            available: { ...triState, description: "Whether they have it in stock now" },
            price_reais: { type: ["number", "null"], description: "Price of one box in reais, as said, or null" },
            package: { type: "string", description: "What one box has, as said, or empty" },
            farmacia_popular: { ...triState, description: "Whether it can be taken through Farmácia Popular there" },
          },
          required: ["medication", "available", "price_reais", "package", "farmacia_popular"],
          additionalProperties: false,
        },
      },
      note: { type: "string", description: "Other useful detail in Portuguese, or empty" },
    },
    required: ["items", "note"],
    additionalProperties: false,
  },
};

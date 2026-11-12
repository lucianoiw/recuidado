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
    "If you hear a recorded menu (for example \"digite\", \"tecle\", \"pressione\", \"para falar com\", \"opção\"), it is a recording: stay completely silent while it plays and until a person speaks (the system usually picks the key for you). The only way to press a key is to delegate the key press; saying the number aloud does nothing and the menu will repeat. Listen to the options and delegate which key to press: the option to talk to an attendant, the pharmacy counter, prices or medicines. If no option fits, pick the one for an attendant or other subjects. If it asks for a CPF or other personal data, delegate to press the key for an attendant or to go back, never type personal data. Delegate one menu choice at a time and wait for the next menu or a person.",
    `Your first words to a person must always be exactly: "${pharmacyOpening(ctx, now)}" Say it even if the person already started talking or already gave some answers: they must hear that you are a virtual assistant before anything else.`,
    `Medicines to ask about, in this order: ${list}.`,
    "For each medicine, find out: whether they have it in stock now, the price of one box of the generic (genérico) and of the reference brand (referência), and how many pills come in a box. If they have only one of the two, find out which one it is. Ask \"Tem genérico?\" and then the prices if they did not say them. Do not ask about Farmácia Popular: the app already knows which medicines are free there and which pharmacies are accredited. Ask one short question at a time and only what is still missing.",
    "If a person asks you to wait (for example \"só um minuto\", \"um momento\", \"já te atendo\"), say only \"Claro, eu aguardo.\" and then stay silent until they speak to you again.",
    "During a hold message or hold music, stay silent.",
    "If they say the price changes or they do not give prices by phone, accept it politely and move on.",
    "Never buy, reserve or order anything, never give a name, CPF, address or phone number, and never discuss treatment or doses. If they ask for personal data, say: \"É só uma consulta de preço, obrigada.\"",
    "If they ask who is calling, say: \"Sou a assistente virtual da Recuidado, um app que ajuda famílias a cuidar dos remédios de uma pessoa idosa.\"",
    "Phone lines blur numbers (\"treze\" sounds like \"três\"). When you have both prices, repeat them back once in one short sentence, with words, and wait: \"Então o genérico treze e noventa e o de referência vinte e quatro e noventa, certo?\". If they correct a price, use the corrected one. Do not repeat anything else.",
    `When you have the answers for all medicines, confirmed, or they cannot help, say exactly "${PHARMACY_GOODBYE}" and, at the same time, delegate once so the answers are recorded. Always delegate before or while saying goodbye, never skip it, and do not wait for the result. Do not say filler like \"vou anotar\".`,
    "After the goodbye, say nothing else, even when the delegated result arrives.",
  ].join("\n");
}

/** Backend prompt for the delegated Responses model on a pharmacy call. */
export function buildPharmacyDelegateInstructions(ctx: PharmacyContext): string {
  return [
    "You act for a voice assistant that is on a phone call with a pharmacy. You only call tools.",
    `If the call reached a recorded menu and a key must be pressed, call ${KEYPAD_TOOL_NAME} with the key (one menu choice, usually one digit). After its result, reply only: Stay silent and listen to the menu or the attendant.`,
    `When the conversation with the attendant is over, call ${PHARMACY_TOOL_NAME} once with one item per medicine, in this order: ${ctx.medications.map(spoken).join("; ")}.`,
    "available: \"yes\" only if they said they have it now, \"no\" if they said they do not, \"unknown\" otherwise.",
    "generic_price_reais: the price of one box of the generic in reais as they said it (for example 18.9), or null. reference_price_reais: the same for the reference brand, or null. price_reais: a box price they said without saying if it is generic or reference, or null. Never guess or compute a price.",
    "package: what the box has as they said it (for example \"caixa com 30 comprimidos\"), or empty.",
    "note: anything else useful the family should know, in Portuguese, short, or empty.",
    `After the ${PHARMACY_TOOL_NAME} result, reply only: Recorded. The goodbye was already said; say nothing else.`,
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
  description: "Records what the pharmacy said about stock and generic and reference prices for each medicine.",
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
            generic_price_reais: { type: ["number", "null"], description: "Price of one box of the generic in reais, as said, or null" },
            reference_price_reais: { type: ["number", "null"], description: "Price of one box of the reference brand in reais, as said, or null" },
            price_reais: { type: ["number", "null"], description: "Box price said without saying generic or reference, or null" },
            package: { type: "string", description: "What one box has, as said, or empty" },
          },
          required: ["medication", "available", "generic_price_reais", "reference_price_reais", "price_reais", "package"],
          additionalProperties: false,
        },
      },
      note: { type: "string", description: "Other useful detail in Portuguese, or empty" },
    },
    required: ["items", "note"],
    additionalProperties: false,
  },
};

/** What the other side of a pharmacy call is doing, as classified by the second model. */
export const OTHER_SIDE = ["menu", "hold", "person", "person_wait", "closed", "voicemail", "unclear"] as const;
export type OtherSide = (typeof OTHER_SIDE)[number];
export const MENU_KEYS = ["none", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#"] as const;

/**
 * GPT-Live Decisions trigger: on every piece of the other side's transcript, a second model
 * answers what the other side is doing and, for a menu, which key to press. The call code acts on it.
 */
export const pharmacyTriggers = [
  {
    type: "decisions",
    event_type: "session.input_transcript.delta",
    decisions: {
      questions: [
        {
          type: "choice",
          name: "other_side",
          instructions: [
            "This is a phone call from a virtual assistant to a pharmacy in Brazil. Classify what the OTHER side (not the assistant) is doing in what it said most recently.",
            "menu: a recording that lists options or asks to press a key or say an option (\"tecle\", \"digite\", \"para ... tecle 2\", \"diga o nome do setor\").",
            "hold: a recording or music asking to wait in line (\"aguarde\", \"todos os atendentes estão ocupados\", \"sua ligação é importante\").",
            "person: a live person talking: a short greeting with the store name (\"Drogaria X, boa tarde\"), an answer, a question.",
            "A welcome like \"Bem-vindo à Farmácia X\", \"Você ligou para a Drogaria X\" or \"Obrigado por ligar\" is the start of a recorded menu, not a person.",
            "person_wait: a live person asking to wait a moment (\"só um minuto\", \"um momento\", \"já te atendo\", \"aguarda aí\").",
            "closed: a recording saying the store is closed or giving opening hours.",
            "voicemail: a recording asking to leave a message.",
            "unclear: too little to tell.",
            "A recording sounds formal and complete and does not react to the assistant. A person reacts, hesitates and uses informal words.",
          ].join(" "),
          choices: OTHER_SIDE.map((value) => ({ value })),
        },
        {
          type: "choice",
          name: "menu_key",
          instructions:
            "Only when the other side is a recorded menu that asks to press keys: the key whose option best leads to medicine price or stock; if none, to an attendant or the pharmacy counter; if none, to medicines. Otherwise none. Never a key that asks for personal data.",
          choices: MENU_KEYS.map((value) => ({ value })),
        },
      ],
    },
  },
];

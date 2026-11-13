/**
 * Turns the raw log of a call (apps/voice, in English) into the few steps a person cares about, in
 * Portuguese: who answered, which key was pressed, when the assistant spoke, what it recorded, how it ended.
 * The raw log stays one tap away ("Ver o log completo").
 */
export interface CallEvent {
  atMs: number;
  text: string;
}

export interface Step {
  atMs: number;
  text: string;
  /** What the call recorded (answer, prices): shown highlighted. */
  saved?: boolean;
}

const SIDE: Record<string, string> = {
  menu: "Caiu em um menu gravado",
  hold: "Música de espera",
  person: "Uma pessoa atendeu",
  person_wait: "A pessoa pediu para esperar",
  closed: "Mensagem de farmácia fechada",
  voicemail: "Caixa postal",
};

function yesNo(v: string): string {
  return v === "true" ? "sim" : v === "false" ? "não" : v;
}

/** One step for a raw line, or null when the line is not worth showing. */
function describe(text: string): Omit<Step, "atMs"> | null {
  let m: RegExpMatchArray | null;
  if (text === "event transport.answered") return { text: "Ligação atendida" };
  if (text.startsWith("recording started")) return { text: "Gravação começou" };
  if ((m = text.match(/^other side: (\w+)/))) return SIDE[m[1]] ? { text: SIDE[m[1]] } : null;
  if ((m = text.match(/^menu option chosen (by rule|by the second model): (\S+)/)))
    return { text: `Escolheu a tecla ${m[2]} no menu${m[1] === "by rule" ? " (pela regra)" : " (pelo segundo modelo)"}` };
  if ((m = text.match(/^assistant said option (\S+) aloud/))) return { text: `A assistente falou a opção ${m[1]}; o sistema apertou a tecla` };
  if ((m = text.match(/^dtmf sent: (\S+)/))) return { text: `Tecla ${m[1]} enviada` };
  if (text.startsWith("person on the line")) return { text: "Pessoa na linha: a assistente se apresenta" };
  if (text === "voice gate: AI heard" || /^voice gate: AI heard/.test(text)) return { text: "A assistente passou a ser ouvida" };
  if (text.startsWith("required line sent")) return { text: "Assistente falou a frase obrigatória" };
  if (text.startsWith("line silent for")) return { text: "Linha em silêncio: a assistente disse \"Alô?\"" };
  if (text.startsWith("nothing heard") && text.endsWith("asking again")) return { text: "Ninguém respondeu: a assistente perguntou de novo" };
  if (text.startsWith("nothing heard")) return { text: "Ninguém respondeu: desligou" };
  if (text.startsWith("waited") && text.includes("checking the line")) return { text: "Esperou demais: a assistente perguntou \"Ainda está aí?\"" };
  if (text.startsWith("person quiet for")) return { text: "A pessoa ficou quieta: a assistente perguntou de novo" };
  if ((m = text.match(/^dose answer recorded: taken=(\w+)/))) return { text: `Registrou: tomou o remédio? ${yesNo(m[1])}`, saved: true };
  if ((m = text.match(/^pharmacy answer recorded: \d+ items \| (.*)$/)))
    return { text: `Registrou: ${m[1].split(" | ").join("; ")}`, saved: true };
  if (text.startsWith("pharmacy answer recorded")) return { text: "Registrou as respostas da farmácia", saved: true };
  if (text === "answer recorded and no goodbye yet, asking for it") return { text: "Registrou a resposta e pediu para a assistente se despedir" };
  if (text === "goodbye heard") return { text: "Assistente se despediu" };
  if (text.startsWith("no goodbye heard")) return { text: "Desligou sem despedida" };
  if (text.startsWith("voicemail")) return { text: "Caixa postal: desligou" };
  if (text.startsWith("closed (recorded")) return { text: "Farmácia fechada: desligou" };
  if (text.startsWith("assistant still silent")) return { text: "A assistente não respondeu: desligou" };
  if (text === "max call duration reached") return { text: "Tempo máximo da ligação: desligou" };
  if (text === "alert call answered") return { text: "Recado atendido" };
  if (text === "alert message delivered") return { text: "Recado entregue", saved: true };
  if (text === "playing recorded greeting") return { text: "Tocou a saudação gravada" };
  if (text === "the person is back") return { text: "A pessoa voltou" };
  if (text === "event session.closed") return { text: "Ligação encerrada" };
  if (text === "live error" || text === "sideband error") return { text: "Erro na ligação" };
  return null;
}

/** The key steps of a call, without repeating the same step back to back. */
export function keySteps(events: CallEvent[]): Step[] {
  const steps: Step[] = [];
  for (const e of events) {
    const d = describe(e.text);
    if (!d) continue;
    if (steps.at(-1)?.text === d.text) continue;
    steps.push({ atMs: e.atMs, ...d });
  }
  return steps;
}

export interface PharmacyAnswer {
  answers: {
    medication: string;
    available: "yes" | "no" | "unknown";
    genericPriceCents?: number | null;
    referencePriceCents?: number | null;
  }[];
  matchesOffers: "yes" | "no" | "unknown" | null;
}

function reais(cents: number | null | undefined): string {
  return cents == null ? "?" : (cents / 100).toFixed(2).replace(".", ",");
}

/** "Losartana 50 mg: tem, genérico 10,90, referência 19,90; ...; cobre oferta: sim". */
export function pharmacyAnswerText(p: PharmacyAnswer): string {
  const items = p.answers.map((a) =>
    a.available === "no"
      ? `${a.medication}: não tem`
      : `${a.medication}: ${a.available === "yes" ? "tem" : "?"}, genérico ${reais(a.genericPriceCents)}, referência ${reais(a.referencePriceCents)}`,
  );
  const offers = p.matchesOffers === "yes" ? "sim" : p.matchesOffers === "no" ? "não" : null;
  return [...items, ...(offers ? [`cobre oferta: ${offers}`] : [])].join("; ");
}

const PLACES: [RegExp, string][] = [
  [/^unidades de referência para tratamento de hepatites virais/i, "postos de referência em hepatites"],
  [/^unidades de referência/i, "postos de referência"],
  [/^SAE\/IST\/AIDS/i, "SAE (serviço de IST/AIDS)"],
];

function shortDetail(raw: string): string | null {
  const text = raw.replace(/\s+(Necessário|Orientação|O rientação)\b.*$/i, "").trim();
  if (!text) return null;
  if (/oftalmologista/i.test(text)) return "Precisa de receita de oftalmologista";
  if (/^Exclusivamente para pacientes em tratamento nestas unidades/i.test(text)) return "Só para quem se trata lá";
  const only = text.match(/^(?:Exclusivamente para|(?:medicamento )?exclusivo para|Dispensação exclusiva para)\s+(.*)$/i);
  if (only) return `Só para ${only[1]}`;
  return capitalize(text);
}

/**
 * The city list's text for an item given only at some units, made short for the screen.
 * "medicamento disponível em unidades de referência Exclusivamente para pacientes cadastrados no Programa..."
 * -> { place: "postos de referência", detail: "Só para pacientes cadastrados no Programa..." }.
 */
export function restrictedPlace(text: string): { place: string; detail: string | null } {
  const body = text.replace(/^medicamento disponível (em|nas?|nos?)\s+/i, "").trim();
  const cut = body.search(/\s+-\s+|\s+(Exclusivamente|Dispensação|Necessário|Orientação)\b/);
  const where = (cut >= 0 ? body.slice(0, cut) : body).trim();
  const rest = (cut >= 0 ? body.slice(cut).replace(/^\s+-\s+/, "") : "").trim();
  const place = PLACES.find(([re]) => re.test(where))?.[1] ?? where;
  return { place, detail: shortDetail(rest) };
}

/** CID written without the dot, as SES-SP lists it: "I500" -> "I50.0". */
export function formatCid(code: string): string {
  return code.length > 3 ? `${code.slice(0, 3)}.${code.slice(3)}` : code;
}

export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1);
}

/** One program that has this medicine, as GET /family sends it (FreeAccess.programs). */
export interface ProgramMatch {
  programId: string;
  name: string;
  kind: "free" | "high_cost" | "home_delivery" | "supplies" | "discount" | string;
  channel: string;
  documents: string[];
  rules: { kind: string; text: string; status?: "yes" | "missing" | "no" }[];
  status: "yes" | "missing" | "no";
}

/** Programs the screens already show elsewhere: "Grátis em", the posto line and the Alto Custo path. */
const SHOWN = new Set(["farmacia_popular", "remume_sp", "ceaf_sp"]);

/** "Vale Mais Saúde (desconto do laboratório Novartis)" -> "Vale Mais Saúde". */
const shortName = (name: string) => name.replace(/\s*\(.*\)\s*$/, "").trim();

export type ExtraProgram = { id: string; kind: string; text: string };

/**
 * The other ways to get this medicine (home delivery, Dose Certa, AMG supplies, lab discount), one line each.
 * A program she does not qualify for is left out; one we cannot check says so.
 */
export function extraPrograms(programs: ProgramMatch[] | undefined, highCost: boolean): ExtraProgram[] {
  const out: ExtraProgram[] = [];
  for (const p of programs ?? []) {
    if (SHOWN.has(p.programId) || p.status === "no") continue;
    const name = shortName(p.name);
    let text: string;
    if (p.kind === "home_delivery") text = `Pode chegar em casa a cada 3 meses (${name}). Peça na UBS onde faz acompanhamento.`;
    else if (p.kind === "supplies") text = `Aparelho, tiras e seringas de graça na UBS (${name}). O médico preenche o formulário.`;
    else if (p.kind === "discount")
      text = highCost
        ? `Enquanto o Alto Custo não sai, compre com o desconto do laboratório (${name}). Quando aprovar, fica de graça.`
        : `O laboratório tem desconto nesta marca (${name}). O valor aparece na farmácia.`;
    else if (p.programId === "dose_certa_sp")
      text = "Grátis na Farmácia Dose Certa do metrô (Clínicas, Ana Rosa, Sé). Leve receita do SUS com o nome genérico.";
    else if (p.kind === "free") text = `Grátis pelo ${name}. ${p.channel}`;
    else continue;
    out.push({ id: p.programId, kind: p.kind, text: p.status === "missing" ? `${text} Confira as regras.` : text });
  }
  return out;
}

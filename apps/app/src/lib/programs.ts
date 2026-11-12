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

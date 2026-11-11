/** One medication presentation the family can pick while typing. */
export type MedOption = { name: string; strength: string };

// Temporary local list of common presentations. The data thread is building the
// Anvisa/CMED search in the API; searchMedications() switches to it once it lands.
const LOCAL: [string, string[]][] = [
  ["AAS", ["100 mg"]],
  ["Anlodipino", ["5 mg", "10 mg"]],
  ["Atenolol", ["25 mg", "50 mg"]],
  ["Atorvastatina", ["10 mg", "20 mg", "40 mg"]],
  ["Captopril", ["25 mg"]],
  ["Carvedilol", ["6,25 mg", "12,5 mg", "25 mg"]],
  ["Enalapril", ["10 mg", "20 mg"]],
  ["Espironolactona", ["25 mg"]],
  ["Furosemida", ["40 mg"]],
  ["Glibenclamida", ["5 mg"]],
  ["Hidroclorotiazida", ["25 mg"]],
  ["Insulina NPH", ["100 UI/mL"]],
  ["Levotiroxina", ["25 mcg", "50 mcg", "100 mcg"]],
  ["Losartana", ["25 mg", "50 mg", "100 mg"]],
  ["Metformina", ["500 mg", "850 mg"]],
  ["Omeprazol", ["20 mg"]],
  ["Rosuvastatina", ["10 mg", "20 mg"]],
  ["Sinvastatina", ["20 mg", "40 mg"]],
];

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

/** Up to `limit` presentations whose name starts with (or contains) the query. */
export function searchMedications(query: string, limit = 6): MedOption[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const starts = LOCAL.filter(([n]) => fold(n).startsWith(q));
  const contains = LOCAL.filter(([n]) => !fold(n).startsWith(q) && fold(n).includes(q));
  return [...starts, ...contains]
    .flatMap(([name, strengths]) => strengths.map((strength) => ({ name, strength })))
    .slice(0, limit);
}

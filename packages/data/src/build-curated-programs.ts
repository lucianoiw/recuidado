/**
 * Programs whose lists are short and published as web pages, not as files: typed here from the
 * official page, with the date it was read. Mapped on 12/11/2026 (see README, "Outros programas").
 *
 * - Remédio em Casa (Prefeitura de São Paulo): home delivery every 90 days, 20 items.
 *   prefeitura.sp.gov.br/web/saude/w/programas/5875
 * - Farmácia Dose Certa (Estado de São Paulo, FURP): free pharmacies in metro stations.
 *   saude.sp.gov.br/ses/perfil/gestor/assistencia-farmaceutica/farmacia-dose-certa
 * - AMG, Automonitoramento Glicêmico (Prefeitura de São Paulo, Lei 11.347/2006): meter, strips,
 *   lancets, syringes and NPH/Regular insulin for people who use insulin.
 *   prefeitura.sp.gov.br/web/saude/w/programas/amg-programa-de-automonitoramento-glicemico
 * - Vale Mais Saúde (Novartis): lab discount on its brands, read from the sign-up page
 *   valemaissaude.com.br/cadastrar. A discount, never "free": the value only shows at the counter.
 *
 * Output: seed/programs/remedio_em_casa_sp.json, dose_certa_sp.json, amg_sp.json, vale_mais_saude.json
 */
import { join } from "node:path";
import { writeJson } from "./lib/csv.ts";
import { looseKey, looseMatchKey, parseStrengths } from "./lib/normalize.ts";
import { ensureDir } from "./lib/paths.ts";
import { isExtendedRelease, PROGRAMS_DIR, type BenefitProgram, type BenefitProgramItem, type ProgramFile } from "./programs.ts";

/** One line of an official list: active ingredient(s) joined by "+", strength as written, form. */
type Line = [ingredients: string, strength: string, form: string];

const SAO_PAULO = "3550308";

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function item(program: BenefitProgram, [ingredients, strength, form]: Line, extra: Partial<BenefitProgramItem> = {}): BenefitProgramItem {
  const activeIngredients = ingredients.split("+").map((part) => part.trim()).filter(Boolean);
  const name = [ingredients, strength, form].filter(Boolean).join(" ");
  return {
    programId: program.id,
    key: slug(name),
    name,
    activeIngredients,
    looseKey: looseKey(activeIngredients),
    looseMatchKey: strength ? looseMatchKey(activeIngredients, parseStrengths(strength)) : looseKey(activeIngredients),
    extendedRelease: isExtendedRelease(name),
    access: "open",
    availability: null,
    group: null,
    conditions: [],
    conditionCodes: [],
    rules: [],
    sourceUrl: null,
    ...extra,
  };
}

/** A supply with no active ingredient (strips, lancets): listed, never matched to a medicine. */
function supply(program: BenefitProgram, name: string): BenefitProgramItem {
  return { ...item(program, ["", "", name]), key: slug(name), name, activeIngredients: [], looseKey: null, looseMatchKey: null };
}

export function remedioEmCasaProgram(): ProgramFile {
  const program: BenefitProgram = {
    id: "remedio_em_casa_sp",
    name: "Remédio em Casa (Prefeitura de São Paulo)",
    kind: "home_delivery",
    level: "municipal",
    region: SAO_PAULO,
    channel: "Peça na UBS onde ela faz acompanhamento. O remédio chega em casa, para 90 dias.",
    sourceUrl: "https://prefeitura.sp.gov.br/web/saude/w/programas/5875",
    version: "2026-11-12",
    documents: ["Cartão do SUS", "Receita da UBS", "Formulário do programa, preenchido na UBS"],
    rules: [
      { kind: "residence", value: SAO_PAULO, text: "para quem mora na cidade de São Paulo" },
      { kind: "note", text: "Para doença crônica estável e controlada, com acompanhamento na UBS." },
    ],
  };
  const lines: Line[] = [
    ["hidroclorotiazida", "25 mg", "comprimido"],
    ["propranolol", "40 mg", "comprimido"],
    ["atenolol", "50 mg", "comprimido"],
    ["captopril", "25 mg", "comprimido"],
    ["enalapril", "20 mg", "comprimido"],
    ["enalapril", "5 mg", "comprimido"],
    ["nifedipino", "20 mg", "comprimido"],
    ["anlodipino", "5 mg", "comprimido"],
    ["anlodipino", "10 mg", "comprimido"],
    ["ácido acetilsalicílico", "100 mg", "comprimido"],
    ["metformina", "850 mg", "comprimido"],
    ["metformina", "500 mg", "comprimido"],
    ["gliclazida", "60 mg", "comprimido de liberação modificada"],
    ["sinvastatina", "10 mg", "comprimido"],
    ["sinvastatina", "20 mg", "comprimido"],
    ["sinvastatina", "40 mg", "comprimido"],
    ["levotiroxina", "25 mcg", "comprimido"],
    ["levotiroxina", "50 mcg", "comprimido"],
    ["levotiroxina", "100 mcg", "comprimido"],
    ["losartana potássica", "50 mg", "comprimido"],
  ];
  return { program, items: lines.map((line) => item(program, line)) };
}

export function doseCertaProgram(): ProgramFile {
  const program: BenefitProgram = {
    id: "dose_certa_sp",
    name: "Farmácia Dose Certa (Governo do Estado de São Paulo)",
    kind: "free",
    level: "state",
    region: SAO_PAULO,
    channel:
      "Nas Farmácias Dose Certa do Estado, de segunda a sexta, das 8h às 17h: metrô Ana Rosa, Brás, Clínicas, Corinthians-Itaquera, Santana, Saúde, Sé e Vila Mariana; CPTM Guaianazes e Santo Amaro; terminal São Mateus; hospitais Sapopemba, Pedreira, Santa Marcelina e Mandaqui.",
    sourceUrl: "https://saude.sp.gov.br/ses/perfil/gestor/assistencia-farmaceutica/farmacia-dose-certa",
    version: "2026-11-12",
    documents: ["Receita do SUS do Estado de São Paulo, com o nome genérico do remédio", "Cartão do SUS"],
    rules: [
      { kind: "note", text: "A receita tem que ser do SUS e vale 180 dias para remédio de uso contínuo (30 dias para controlado, 10 para antibiótico)." },
      { kind: "note", text: "Receita particular só nas unidades Mandaqui, Pedreira, Guaianazes e Sé, com Cartão do SUS da cidade de São Paulo." },
    ],
  };
  const lines: Line[] = [
    ["ácido acetilsalicílico", "100 mg", "comprimido"],
    ["ácido valproico", "250 mg", "comprimido ou cápsula"],
    ["amitriptilina", "25 mg", "comprimido"],
    ["amoxicilina", "250 mg/5 ml", "pó para suspensão oral"],
    ["amoxicilina", "500 mg", "cápsula"],
    ["benzilpenicilina benzatina", "1.200.000 UI", "pó para suspensão injetável"],
    ["biperideno", "2 mg", "comprimido"],
    ["captopril", "25 mg", "comprimido"],
    ["carbamazepina", "200 mg", "comprimido"],
    ["carbonato de lítio", "300 mg", "comprimido"],
    ["cefalexina", "250 mg/5 ml", "pó para suspensão oral"],
    ["cefalexina", "500 mg", "cápsula"],
    ["cimetidina", "200 mg", "comprimido"],
    ["clomipramina", "25 mg", "drágea"],
    ["clorpromazina", "100 mg", "comprimido"],
    ["clorpromazina", "25 mg", "comprimido"],
    ["dexametasona", "1 mg/g", "creme"],
    ["diazepam", "10 mg", "comprimido"],
    ["diclofenaco sódico", "50 mg", "comprimido revestido"],
    ["digoxina", "0,25 mg", "comprimido"],
    ["dipirona sódica", "500 mg/ml", "solução oral"],
    ["etinilestradiol + levonorgestrel", "0,03 mg + 0,15 mg", "comprimido"],
    ["fenitoína", "100 mg", "comprimido"],
    ["fenobarbital", "100 mg", "comprimido"],
    ["furosemida", "40 mg", "comprimido"],
    ["glibenclamida", "5 mg", "comprimido"],
    ["haloperidol", "2 mg/ml", "solução oral"],
    ["haloperidol", "5 mg", "comprimido"],
    ["hidroclorotiazida", "25 mg", "comprimido"],
    ["imipramina", "25 mg", "comprimido"],
    ["levomepromazina", "40 mg/ml", "solução oral"],
    ["levonorgestrel", "0,75 mg", "comprimido"],
    ["mebendazol", "100 mg", "comprimido"],
    ["mebendazol", "100 mg/5 ml", "suspensão oral"],
    ["medroxiprogesterona", "150 mg", "solução injetável"],
    ["metildopa", "250 mg", "comprimido revestido"],
    ["metoclopramida", "10 mg", "comprimido"],
    ["metronidazol", "250 mg", "comprimido"],
    ["metronidazol", "40 mg/ml", "suspensão oral"],
    ["naltrexona", "50 mg", "comprimido revestido"],
    ["nifedipino", "20 mg", "comprimido revestido"],
    ["nitrazepam", "5 mg", "comprimido"],
    ["noretisterona", "0,35 mg", "comprimido"],
    ["nortriptilina", "25 mg", "comprimido ou cápsula"],
    ["paracetamol", "200 mg/ml", "solução oral"],
    ["prometazina", "25 mg", "comprimido"],
    ["propranolol", "40 mg", "comprimido"],
    ["sulfametoxazol + trimetoprima", "400 mg + 80 mg", "comprimido"],
    ["sulfametoxazol + trimetoprima", "200 mg + 40 mg/5 ml", "suspensão oral"],
    ["sulfato ferroso", "25 mg/ml", "solução oral"],
    ["tiamina", "300 mg", "comprimido revestido"],
    ["tioridazina", "100 mg", "comprimido"],
  ];
  return { program, items: lines.map((line) => item(program, line)) };
}

export function amgProgram(): ProgramFile {
  const program: BenefitProgram = {
    id: "amg_sp",
    name: "Automonitoramento Glicêmico, AMG (Prefeitura de São Paulo)",
    kind: "supplies",
    level: "municipal",
    region: SAO_PAULO,
    channel:
      "Cadastro em qualquer UBS, com o formulário preenchido pelo médico. O aparelho fica emprestado e as tiras, lancetas e seringas saem todo mês, com retirada agendada.",
    sourceUrl: "https://prefeitura.sp.gov.br/web/saude/w/programas/amg-programa-de-automonitoramento-glicemico",
    version: "2026-11-12",
    documents: ["Cartão do SUS", "Formulário de solicitação de insumos AMG (versão 2026), preenchido pelo médico"],
    rules: [
      { kind: "residence", value: SAO_PAULO, text: "para quem mora na cidade de São Paulo" },
      { kind: "condition", value: ["Diabetes com uso de insulina"], text: "para quem tem diabetes e usa insulina" },
      { kind: "note", text: "Em todo o Brasil, a Lei 11.347/2006 garante insulina e material de aplicação e medida para quem usa insulina." },
    ],
  };
  return {
    program,
    items: [
      item(program, ["insulina humana NPH", "100 UI/ml", "suspensão injetável"]),
      item(program, ["insulina humana regular", "100 UI/ml", "solução injetável"]),
      supply(program, "Aparelho medidor de glicose (emprestado)"),
      supply(program, "Tiras para medir glicose"),
      supply(program, "Lancetas"),
      supply(program, "Seringas com agulha para insulina"),
      supply(program, "Coletor para descarte de agulhas"),
    ],
  };
}

export function valeMaisSaudeProgram(): ProgramFile {
  const program: BenefitProgram = {
    id: "vale_mais_saude",
    name: "Vale Mais Saúde (desconto do laboratório Novartis)",
    kind: "discount",
    level: "private",
    region: "BR",
    channel: "Cadastro no site valemaissaude.com.br, pelo telefone 0800 707 1080 ou na farmácia. O desconto sai no caixa da farmácia.",
    sourceUrl: "https://www.valemaissaude.com.br/cadastrar",
    version: "2026-11-12",
    documents: ["CPF de quem faz o cadastro", "Receita com o CRM do médico"],
    rules: [
      { kind: "note", text: "Desconto só na marca do laboratório, não no genérico. O valor aparece na farmácia." },
      { kind: "note", text: "Programa do laboratório, não do SUS. O Recuidado não faz o cadastro pela família." },
    ],
  };
  const brand = (name: string): Partial<BenefitProgramItem> => ({ availability: `Marca ${name}` });
  const lines: [Line, string][] = [
    [["sacubitril valsartana", "50 mg", "comprimido"], "Entresto"],
    [["sacubitril valsartana", "100 mg", "comprimido"], "Entresto"],
    [["sacubitril valsartana", "200 mg", "comprimido"], "Entresto"],
    [["valsartana", "80 mg", "comprimido"], "Diovan"],
    [["valsartana", "160 mg", "comprimido"], "Diovan"],
    [["valsartana", "320 mg", "comprimido"], "Diovan"],
    [["valsartana + hidroclorotiazida", "80 mg + 12,5 mg", "comprimido"], "Diovan HCT"],
    [["valsartana + hidroclorotiazida", "160 mg + 12,5 mg", "comprimido"], "Diovan HCT"],
    [["valsartana + hidroclorotiazida", "160 mg + 25 mg", "comprimido"], "Diovan HCT"],
    [["valsartana + hidroclorotiazida", "320 mg + 12,5 mg", "comprimido"], "Diovan HCT"],
    [["valsartana + hidroclorotiazida", "320 mg + 25 mg", "comprimido"], "Diovan HCT"],
    [["valsartana + anlodipino", "80 mg + 5 mg", "comprimido"], "Diovan Amlo Fix"],
    [["valsartana + anlodipino", "160 mg + 5 mg", "comprimido"], "Diovan Amlo Fix"],
    [["valsartana + anlodipino", "160 mg + 10 mg", "comprimido"], "Diovan Amlo Fix"],
    [["valsartana + anlodipino", "320 mg + 5 mg", "comprimido"], "Diovan Amlo Fix"],
    [["valsartana + anlodipino", "320 mg + 10 mg", "comprimido"], "Diovan Amlo Fix"],
    [["vildagliptina", "50 mg", "comprimido"], "Galvus"],
    [["vildagliptina + metformina", "50 mg + 500 mg", "comprimido"], "Galvus Met"],
    [["vildagliptina + metformina", "50 mg + 850 mg", "comprimido"], "Galvus Met"],
    [["vildagliptina + metformina", "50 mg + 1000 mg", "comprimido"], "Galvus Met"],
    [["letrozol", "2,5 mg", "comprimido"], "Femara"],
    [["oxcarbazepina", "300 mg", "comprimido"], "Trileptal"],
    [["oxcarbazepina", "600 mg", "comprimido"], "Trileptal"],
    [["carbamazepina", "200 mg", "comprimido de liberação controlada (CR)"], "Tegretol CR"],
    [["carbamazepina", "400 mg", "comprimido de liberação controlada (CR)"], "Tegretol CR"],
  ];
  return { program, items: lines.map(([line, name]) => ({ ...item(program, line, brand(name)), name: `${name} (${line.slice(0, 2).join(" ")})` })) };
}

export function buildCuratedPrograms(): ProgramFile[] {
  return [remedioEmCasaProgram(), doseCertaProgram(), amgProgram(), valeMaisSaudeProgram()];
}

async function main(): Promise<void> {
  ensureDir(PROGRAMS_DIR);
  for (const file of buildCuratedPrograms()) {
    writeJson(join(PROGRAMS_DIR, `${file.program.id}.json`), file);
    console.log(`${file.program.id}: ${file.items.length} items`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

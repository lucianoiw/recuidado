import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ApiError, type Dose, type FreePlace, type Medication, type RecuidadoApi } from "./api.ts";

const TIME_ZONE = "America/Sao_Paulo";

const ICONS = [
  { src: "https://mcp.recuidado.com.br/icon-512.png", mimeType: "image/png", sizes: ["512x512"] },
  { src: "https://mcp.recuidado.com.br/icon-192.png", mimeType: "image/png", sizes: ["192x192"] },
  { src: "https://mcp.recuidado.com.br/favicon.svg", mimeType: "image/svg+xml", sizes: ["any"] },
];

const INSTRUCTIONS = `Recuidado cuida do remédio de um idoso junto com a família: plano de remédios, o que é grátis no SUS, doses do dia e avisos.
As ferramentas usam a família escolhida ao conectar (ou a família de demonstração, Dona Maria, com dados sintéticos).
Nunca dê conselho clínico nem sugira mudar dose ou tratamento. Para isso, oriente procurar o médico. Em emergência, SAMU 192.`;

const FREE_PLACE_LABEL: Record<FreePlace, string> = {
  farmacia_popular: "Farmácia Popular",
  ubs: "UBS (Prefeitura de São Paulo)",
};

export function localTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

function money(cents: number | null): string | null {
  if (cents === null) return null;
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const DOSE_STATUS: Record<string, string> = { pending: "pendente", taken: "tomada", missed: "perdida" };

function doseView(dose: Dose) {
  return {
    doseId: dose.id,
    remedio: [dose.medicationName, dose.strength].filter(Boolean).join(" "),
    horario: localTime(dose.scheduledAt),
    situacao: DOSE_STATUS[dose.status] ?? dose.status,
    confirmadaPor: dose.confirmedVia === "voice" ? "ligação" : dose.confirmedVia === "app" ? "app" : null,
    confirmadaAs: dose.confirmedAt ? localTime(dose.confirmedAt) : null,
    familiaAvisada: dose.familyAlertedAt !== null,
  };
}

function medicationView(med: Medication) {
  const freeAt = (med.freeAt ?? []).map((place) => FREE_PLACE_LABEL[place]);
  return {
    remedio: med.name,
    dosagem: med.strength,
    horarios: med.times,
    gratisEm: freeAt,
    altoCusto: med.highCost === true,
    comprarMesmoSendoGratis: med.buyInsteadOfFree === true,
    custoMensal: money(med.monthlyCostCents),
    estoque: med.stock
      ? { comprimidos: med.stock.units, diasRestantes: med.stock.daysLeft, acabando: med.stock.low }
      : null,
  };
}

function personName(p: { name: string; nickname: string | null }): string {
  return p.nickname ? `${p.nickname} (${p.name})` : p.name;
}

/** Tool result with the same data as text (for any client) and as structured content. */
function result(data: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
}

function failure(error: unknown) {
  const message =
    error instanceof ApiError
      ? error.message
      : "Não foi possível falar com o Recuidado agora. Tente de novo em instantes.";
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

async function run(tool: string, onCall: ToolCallHook | undefined, body: () => Promise<ReturnType<typeof result>>) {
  try {
    const out = await body();
    onCall?.(tool, true);
    return out;
  } catch (error) {
    onCall?.(tool, false, error);
    return failure(error);
  }
}

export type ToolCallHook = (tool: string, ok: boolean, error?: unknown) => void;

/**
 * One MCP server bound to one family: the one linked at login (null is the demo family).
 * Tools never take a family id, so a client only reaches the family it was linked to.
 */
export function createRecuidadoServer(api: RecuidadoApi, family: string | null, onCall?: ToolCallHook): McpServer {
  const familyId = family ?? undefined;
  const server = new McpServer(
    {
      name: "recuidado",
      title: "Recuidado",
      version: "0.2.0",
      description: "Remédios do idoso junto com a família: plano, doses do dia, avisos e o que é grátis no SUS.",
      websiteUrl: "https://recuidado.com.br",
      icons: ICONS,
    },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "get_care_plan",
    {
      title: "Plano de cuidado",
      description:
        "Mostra o plano de remédios da pessoa cuidada: cada remédio com dosagem, horários, onde é grátis (Farmácia Popular, UBS), se entra no Alto Custo, custo do mês e quantos comprimidos restam. Também lista quem da família cuida.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () =>
      run("get_care_plan", onCall, async () => {
        const family = await api.family(familyId);
        return result({
          familia: family.isDemo ? "demonstração (dados sintéticos)" : "família conectada",
          pessoaCuidada: personName(family.patient),
          cuidadores: family.caregivers.map((c) => ({
            nome: personName(c),
            parentesco: c.relation,
            convitePendente: c.pending === true,
          })),
          remedios: family.medications.map(medicationView),
        });
      }),
  );

  server.registerTool(
    "get_today_doses",
    {
      title: "Doses de hoje",
      description:
        "Lista as doses de hoje (horário de Brasília) e se cada uma foi tomada, está pendente ou foi perdida, por onde foi confirmada (app ou ligação) e se a família foi avisada. Inclui o que a pessoa disse nas ligações das últimas 24 horas quando relatou não estar bem.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () =>
      run("get_today_doses", onCall, async () => {
        const family = await api.family(familyId);
        const doses = family.today.map(doseView);
        return result({
          pessoaCuidada: personName(family.patient),
          resumo: summary(doses),
          doses,
          relatosDeMalEstar: family.unwellReports.map((r) => ({ horario: localTime(r.at), oQueDisse: r.note })),
        });
      }),
  );

  server.registerTool(
    "confirm_dose",
    {
      title: "Confirmar dose",
      description:
        "Marca uma dose de hoje como tomada, igual ao botão \"Tomei\" do app. Use só quando a pessoa cuidada ou um familiar disser que ela já tomou. Pegue o doseId em get_today_doses. Cancela a ligação e o aviso à família daquela dose.",
      inputSchema: z.object({
        doseId: z.uuid().describe("Id da dose, de get_today_doses."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ doseId }) =>
      run("confirm_dose", onCall, async () => {
        // The API confirms any dose id; only doses of today in the linked family are accepted here.
        const family = await api.family(familyId);
        const dose = family.today.find((d) => d.id === doseId);
        if (!dose) throw new ApiError(404, "Essa dose não é de hoje nesta família. Veja as doses em get_today_doses.");
        if (dose.status === "taken") return result({ confirmada: true, jaEstavaConfirmada: true, dose: doseView(dose) });
        await api.confirmDose(doseId);
        return result({ confirmada: true, dose: { ...doseView(dose), situacao: "tomada" } });
      }),
  );

  server.registerTool(
    "list_family_alerts",
    {
      title: "Avisos à família",
      description:
        "Lista os avisos que o Recuidado mandou para a família, do mais novo para o mais antigo: dose não confirmada, pessoa disse que não está bem, remédio acabando.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(10).describe("Quantos avisos, de 1 a 50."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ limit }) =>
      run("list_family_alerts", onCall, async () => {
        const alerts = (await api.alerts(familyId)).slice(0, limit);
        return result({
          avisos: alerts.map((a) => ({
            tipo: ALERT_KIND[a.kind] ?? a.kind,
            titulo: a.title,
            texto: a.body,
            quando: new Date(a.createdAt).toLocaleString("pt-BR", { timeZone: TIME_ZONE }),
          })),
        });
      }),
  );

  server.registerTool(
    "find_free_medicine",
    {
      title: "Onde o remédio é grátis",
      description:
        "Busca um remédio pelo nome comercial ou princípio ativo (lista da CMED) e diz, para cada dosagem, se é grátis no Farmácia Popular ou nas UBS da Prefeitura de São Paulo, e se está na lista do Alto Custo (CEAF), que exige laudo do médico.",
      inputSchema: z.object({
        query: z.string().trim().min(3).max(80).describe("Nome do remédio, por exemplo \"losartana 50\" ou \"Glifage\"."),
        limit: z.number().int().min(1).max(10).default(5).describe("Quantos remédios, de 1 a 10."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ query, limit }) =>
      run("find_free_medicine", onCall, async () => {
        const found = await api.searchMedicines(query, limit);
        return result({
          remedios: found.map((m) => ({
            nome: m.name,
            principioAtivo: m.activeIngredient,
            tipo: m.kind === "generic" ? "genérico" : "marca",
            laboratorio: m.laboratory,
            dosagens: m.strengths.map((s) => ({
              dosagem: s.strength,
              forma: s.form,
              gratisEm: s.freeAt.map((place) => FREE_PLACE_LABEL[place]),
              altoCusto: s.highCost,
            })),
          })),
          observacao:
            "Grátis no Farmácia Popular exige receita e documento com CPF. Alto Custo exige laudo (LME) do médico e é avaliado pela Secretaria da Saúde.",
        });
      }),
  );

  return server;
}

const ALERT_KIND: Record<string, string> = {
  dose_missed: "dose não confirmada",
  unwell: "não está bem",
  low_stock: "remédio acabando",
  emergency: "emergência",
  emergency_call: "ligação de emergência para a família",
  check_in: "ligação de volta para ela",
};

function summary(doses: ReturnType<typeof doseView>[]): string {
  if (doses.length === 0) return "Nenhuma dose marcada para hoje.";
  const count = (s: string) => doses.filter((d) => d.situacao === s).length;
  return `${doses.length} doses hoje: ${count("tomada")} tomadas, ${count("pendente")} pendentes, ${count("perdida")} perdidas.`;
}


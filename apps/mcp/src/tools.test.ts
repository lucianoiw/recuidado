import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it } from "vitest";
import { RecuidadoApi } from "./api.ts";
import { createRecuidadoServer } from "./tools.ts";

const FAMILY = "11111111-1111-4111-8111-111111111111";
const DOSE = "22222222-2222-4222-8222-222222222222";

function overview(status = "pending") {
  return {
    familyId: FAMILY,
    isDemo: true,
    patient: { id: "p", name: "Maria da Silva", nickname: "Dona Maria", role: "patient", relation: null, phone: "(11) 9****-0000" },
    caregivers: [{ id: "c", name: "Ana", nickname: null, role: "caregiver", relation: "filha", phone: "(11) 9****-1111", pending: false }],
    medications: [
      {
        id: "m",
        name: "Losartana potássica",
        strength: "50 mg",
        times: ["08:00", "20:00"],
        freeInFarmaciaPopular: true,
        monthlyCostCents: null,
        buyInsteadOfFree: false,
        freeAt: ["farmacia_popular", "ubs"],
        highCost: false,
        stock: { units: 12, daysLeft: 6, low: false },
      },
    ],
    today: [
      {
        id: DOSE,
        scheduledAt: "2026-11-11T11:00:00.000Z",
        status,
        confirmedVia: null,
        confirmedAt: null,
        familyAlertedAt: null,
        medicationId: "m",
        medicationName: "Losartana potássica",
        strength: "50 mg",
      },
    ],
    unwellReports: [],
  };
}

/** Fake Recuidado API: records the calls and answers like the real one. */
function fakeApi(status = "pending") {
  const calls: string[] = [];
  const fetchFn = (async (input: URL, init?: RequestInit) => {
    const url = new URL(input);
    calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
    const json = (body: unknown, code = 200) => Response.json(body, { status: code });
    if (url.pathname === "/family") return json(overview(status));
    if (url.pathname === "/family/alerts")
      return json([{ id: "a", kind: "dose_missed", title: "Dose não confirmada", body: "Dona Maria não confirmou.", doseId: DOSE, medicationId: "m", createdAt: "2026-11-11T11:31:00.000Z" }]);
    if (url.pathname === "/medications/search")
      return json([{ name: "Losartana potássica", activeIngredient: "Losartana potássica", kind: "generic", laboratory: null, strengths: [{ strength: "50 mg", form: "comprimido", freeAt: ["farmacia_popular"], highCost: false }] }]);
    if (url.pathname === `/doses/${DOSE}/confirm`) return new Response(null, { status: 204 });
    return json({ message: "Not Found" }, 404);
  }) as typeof fetch;
  return { api: new RecuidadoApi("http://api.test", fetchFn), calls };
}

let client: Client | undefined;
afterEach(async () => {
  await client?.close();
  client = undefined;
});

async function connect(api: RecuidadoApi, family: string | null = null) {
  const handler = createMcpHandler(() => createRecuidadoServer(api, family));
  const transport = new StreamableHTTPClientTransport(new URL("http://mcp.test/mcp"), {
    fetch: (input, init) => handler.fetch(new Request(input, init)),
  });
  client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

function data(res: Awaited<ReturnType<Client["callTool"]>>) {
  return res.structuredContent as Record<string, any>;
}

describe("Recuidado MCP", () => {
  it("lists the five tools", async () => {
    const c = await connect(fakeApi().api);
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "confirm_dose",
      "find_free_medicine",
      "get_care_plan",
      "get_today_doses",
      "list_family_alerts",
    ]);
  });

  it("shows the care plan without phones", async () => {
    const { api, calls } = fakeApi();
    const c2 = await connect(api, FAMILY);
    const res = await c2.callTool({ name: "get_care_plan", arguments: {} });
    expect(calls).toEqual([`GET /family?familyId=${FAMILY}`]);
    expect(JSON.stringify(res.content)).not.toContain("9****");
    expect(data(res).remedios[0]).toMatchObject({
      remedio: "Losartana potássica",
      gratisEm: ["Farmácia Popular", "UBS (Prefeitura de São Paulo)"],
      estoque: { comprimidos: 12, diasRestantes: 6, acabando: false },
    });
  });

  it("gives today's doses in Brasília time", async () => {
    const c = await connect(fakeApi().api);
    const res = await c.callTool({ name: "get_today_doses", arguments: {} });
    expect(data(res).doses[0]).toMatchObject({ horario: "08:00", situacao: "pendente" });
    expect(data(res).resumo).toBe("1 doses hoje: 0 tomadas, 1 pendentes, 0 perdidas.");
  });

  it("confirms a dose of today in the family", async () => {
    const { api, calls } = fakeApi();
    const c = await connect(api);
    const res = await c.callTool({ name: "confirm_dose", arguments: { doseId: DOSE } });
    expect(res.isError).toBeFalsy();
    expect(calls).toEqual(["GET /family", `POST /doses/${DOSE}/confirm`]);
  });

  it("does not confirm a dose of another family or day", async () => {
    const { api, calls } = fakeApi();
    const c = await connect(api);
    const res = await c.callTool({
      name: "confirm_dose",
      arguments: { doseId: "33333333-3333-4333-8333-333333333333" },
    });
    expect(res.isError).toBe(true);
    expect(calls).toEqual(["GET /family"]);
  });

  it("does not confirm twice", async () => {
    const { api, calls } = fakeApi("taken");
    const c = await connect(api);
    const res = await c.callTool({ name: "confirm_dose", arguments: { doseId: DOSE } });
    expect(data(res).jaEstavaConfirmada).toBe(true);
    expect(calls).toEqual(["GET /family"]);
  });

  it("lists alerts and searches medicines", async () => {
    const c = await connect(fakeApi().api);
    const alerts = await c.callTool({ name: "list_family_alerts", arguments: {} });
    expect(data(alerts).avisos[0].tipo).toBe("dose não confirmada");
    const found = await c.callTool({ name: "find_free_medicine", arguments: { query: "losartana 50" } });
    expect(data(found).remedios[0].dosagens[0].gratisEm).toEqual(["Farmácia Popular"]);
  });

  it("turns an API error into a readable tool error", async () => {
    const api = new RecuidadoApi("http://api.test", (async () =>
      Response.json({ message: "familyId inválido." }, { status: 400 })) as typeof fetch);
    const c = await connect(api);
    const res = await c.callTool({ name: "get_care_plan", arguments: {} });
    expect(res.isError).toBe(true);
    expect(JSON.stringify(res.content)).toContain("familyId inválido.");
  });
});

/**
 * The few Recuidado API calls the MCP tools need. Only public endpoints, the same ones the web app uses.
 * Response types list just the fields the tools read; the API may send more.
 */

export type FreePlace = "farmacia_popular" | "ubs";

export interface Person {
  id: string;
  name: string;
  nickname: string | null;
  role: string;
  relation: string | null;
  pending?: boolean;
}

export interface Medication {
  id: string;
  name: string;
  strength: string | null;
  times: string[];
  freeInFarmaciaPopular: boolean | null;
  monthlyCostCents: number | null;
  buyInsteadOfFree: boolean | null;
  freeAt?: FreePlace[];
  highCost?: boolean;
  stock: { units: number; daysLeft: number | null; low: boolean } | null;
}

export interface Dose {
  id: string;
  scheduledAt: string;
  status: string;
  confirmedVia: string | null;
  confirmedAt: string | null;
  familyAlertedAt: string | null;
  medicationId: string;
  medicationName: string;
  strength: string | null;
}

export interface FamilyOverview {
  familyId: string;
  isDemo: boolean;
  patient: Person;
  caregivers: Person[];
  medications: Medication[];
  today: Dose[];
  unwellReports: { at: string; note: string | null; doseId: string }[];
}

export interface Alert {
  id: string;
  kind: string;
  title: string;
  body: string;
  doseId: string | null;
  medicationId: string | null;
  createdAt: string;
}

export interface MedicineResult {
  name: string;
  activeIngredient: string;
  kind: "generic" | "brand";
  laboratory: string | null;
  strengths: { strength: string; form: string | null; freeAt: FreePlace[]; highCost: boolean }[];
}

/** Error the tools turn into a readable message for the model. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class RecuidadoApi {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  /** `link`: the secret of the patient link (/m/<secret>) the family connected. Without it, the demo family. */
  family(link?: string): Promise<FamilyOverview> {
    return this.get("/family", {}, link);
  }

  alerts(link?: string): Promise<Alert[]> {
    return this.get("/family/alerts", {}, link);
  }

  searchMedicines(query: string, limit: number): Promise<MedicineResult[]> {
    return this.get("/medications/search", { q: query, limit: String(limit) });
  }

  async confirmDose(doseId: string): Promise<void> {
    await this.request("POST", `/doses/${encodeURIComponent(doseId)}/confirm`);
  }

  private async get<T>(path: string, query: Record<string, string | undefined>, link?: string): Promise<T> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    const search = params.size > 0 ? `?${params}` : "";
    const res = await this.request("GET", `${path}${search}`, link);
    return (await res.json()) as T;
  }

  private async request(method: string, path: string, link?: string): Promise<Response> {
    const res = await this.fetchFn(new URL(path, this.baseUrl), {
      method,
      headers: {
        accept: "application/json",
        "user-agent": "recuidado-mcp",
        // The patient link reads the family, like her app does.
        ...(link ? { authorization: `Bearer p.${link}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
      const message = typeof body?.message === "string" ? body.message : `A API respondeu ${res.status}.`;
      throw new ApiError(res.status, message);
    }
    return res;
  }
}

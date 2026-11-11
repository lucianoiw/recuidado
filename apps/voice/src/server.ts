import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { loadConfig, type VoiceConfig } from "./config.js";
import { CallService, NumberNotAllowedError } from "./call-service.js";
import type { CallResult, ReminderCall } from "./reminder-call.js";
import type { Medication } from "./prompt.js";

interface CallRecord {
  doseId: string;
  call: ReminderCall;
  result?: CallResult;
}

let config: VoiceConfig | undefined;
let configError: string | undefined;
try {
  config = loadConfig();
} catch (err) {
  // Stay up so the stack deploys before the secrets are set; /calls answers 503.
  configError = (err as Error).message;
  console.error(`voice service not configured: ${configError}`);
}
const service = config ? new CallService(config) : undefined;
const calls = new Map<string, CallRecord>();

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function authorized(req: IncomingMessage, config: VoiceConfig): boolean {
  const given = Buffer.from(req.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${config.voiceApiToken}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 64 * 1024) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function parseCallRequest(body: unknown) {
  const b = body as Record<string, unknown>;
  const medications = Array.isArray(b.medications) ? b.medications : [];
  const meds: Medication[] = medications
    .map((m) => (typeof m === "string" ? { name: m } : (m as Medication)))
    .filter((m) => typeof m?.name === "string" && m.name.trim().length > 0)
    .map((m) => ({ name: m.name.trim(), dose: typeof m.dose === "string" ? m.dose.trim() : undefined }));
  if (typeof b.doseId !== "string" || !b.doseId) throw new Error("doseId is required");
  if (typeof b.phone !== "string" || !b.phone) throw new Error("phone is required");
  if (typeof b.patientName !== "string" || !b.patientName.trim()) throw new Error("patientName is required");
  if (meds.length === 0) throw new Error("medications must have at least one item");
  return { doseId: b.doseId, phone: b.phone, patientName: b.patientName.trim(), medications: meds };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, configured: Boolean(service) });
    }

    if (!config || !service) return json(res, 503, { error: "voice service not configured", detail: configError });
    if (!authorized(req, config)) return json(res, 401, { error: "unauthorized" });

    if (req.method === "POST" && url.pathname === "/calls") {
      let input;
      try {
        input = parseCallRequest(await readJson(req));
      } catch (err) {
        return json(res, 400, { error: (err as Error).message });
      }
      try {
        const { sessionId, call } = await service.start(input);
        const record: CallRecord = { doseId: input.doseId, call };
        calls.set(sessionId, record);
        void call.result.then(async (result) => {
          record.result = result;
          console.log(`call ${sessionId} ended: ${result.outcome}`);
          await service.report(input.doseId, result);
        });
        return json(res, 202, { callId: sessionId });
      } catch (err) {
        if (err instanceof NumberNotAllowedError) return json(res, 403, { error: err.message });
        console.error("failed to start call", err);
        return json(res, 502, { error: "failed to start call" });
      }
    }

    const match = url.pathname.match(/^\/calls\/([^/]+)$/);
    if (req.method === "GET" && match) {
      const record = calls.get(decodeURIComponent(match[1]));
      if (!record) return json(res, 404, { error: "not found" });
      return json(res, 200, { doseId: record.doseId, status: record.call.status, result: record.result });
    }

    return json(res, 404, { error: "not found" });
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: "internal error" });
  }
});

const port = config?.port ?? Number(process.env.PORT ?? 5000);
server.listen(port, () => console.log(`voice service listening on :${port}`));

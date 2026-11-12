import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { telemetryFromEnv } from "@recuidado/telemetry";
import { loadConfig, type VoiceConfig } from "./config.js";
import { CallService, NumberNotAllowedError } from "./call-service.js";
import type { CallResult, ReminderCall } from "./reminder-call.js";
import type { Medication } from "./prompt.js";
import type { PharmacyCall, PharmacyCallResult } from "./pharmacy-call.js";
import type { SimMedication } from "./sim-pharmacy.js";

// Events, exceptions and logs go to PostHog; logs also stay on stdout.
const telemetry = telemetryFromEnv("voice");

function log(msg: string, extra?: unknown) {
  if (extra === undefined) return telemetry.info(msg);
  const detail = typeof extra === "string" ? extra : JSON.stringify(extra);
  telemetry.info(`${msg} ${detail}`);
}

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
  telemetry.error(`voice service not configured: ${configError}`);
}
const service = config ? new CallService(config, log) : undefined;
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
  const patientId = typeof b.patientId === "string" && b.patientId ? b.patientId : undefined;
  const checkIn = b.checkIn === true;
  const callBack = b.callBack !== false;
  const gender = b.gender === "male" ? ("male" as const) : ("female" as const);
  const doseTime = typeof b.doseTime === "string" && b.doseTime ? b.doseTime : undefined;
  const recall = b.recall === true;
  const recallLater = b.recallLater === true;
  return {
    doseId: b.doseId,
    patientId,
    phone: b.phone,
    patientName: b.patientName.trim(),
    medications: meds,
    checkIn,
    callBack,
    gender,
    doseTime,
    recall,
    recallLater,
  };
}

function positiveInt(v: unknown): number | undefined {
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : undefined;
}

/** Body of POST /pharmacy-calls. At most 3 medicines, so the call stays short. */
function parsePharmacyCallRequest(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.inquiryId !== "string" || !b.inquiryId) throw new Error("inquiryId is required");
  if (typeof b.phone !== "string" || !b.phone) throw new Error("phone is required");
  const list = Array.isArray(b.medications) ? b.medications : [];
  const medications: SimMedication[] = list
    .map((m) => (typeof m === "string" ? { name: m } : (m as SimMedication)))
    .filter((m) => typeof m?.name === "string" && m.name.trim().length > 0)
    .map((m) => ({
      name: m.name.trim(),
      dose: typeof m.dose === "string" && m.dose.trim() ? m.dose.trim() : undefined,
      // Only used by the simulated pharmacies (sim-pharmacy.ts) to say a believable price.
      refPackCents: positiveInt(m.refPackCents),
      unitsPerPack: positiveInt(m.unitsPerPack),
    }));
  if (medications.length === 0) throw new Error("medications must have at least one item");
  if (medications.length > 3) throw new Error("at most 3 medications per call");
  const familyId = typeof b.familyId === "string" && b.familyId ? b.familyId : undefined;
  return { inquiryId: b.inquiryId, familyId, phone: b.phone, medications };
}

interface PharmacyCallRecord {
  inquiryId: string;
  call: PharmacyCall;
  result?: PharmacyCallResult;
}

const pharmacyCalls = new Map<string, PharmacyCallRecord>();

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
      const { patientId, ...callInput } = input;
      const distinctId = patientId ?? telemetry.systemId;
      const startedAt = Date.now();
      let callId: string | undefined;
      try {
        const { sessionId, call, trail } = await service.start(callInput, (status) => {
          telemetry.capture(`call_${status}`, { dose_id: input.doseId, call_id: callId }, distinctId);
        });
        callId = sessionId;
        const record: CallRecord = { doseId: input.doseId, call };
        calls.set(sessionId, record);
        telemetry.capture("call_started", { dose_id: input.doseId, call_id: sessionId, model: config.liveModel, voice: config.liveVoice }, distinctId);
        void call.result.then(async (result) => {
          record.result = result;
          telemetry.info(`call ${sessionId} ended: ${result.outcome}`, {
            dose_id: input.doseId,
            call_id: sessionId,
            outcome: result.outcome,
            posthogDistinctId: patientId,
          });
          const props = {
            dose_id: input.doseId,
            call_id: sessionId,
            outcome: result.outcome,
            confirmed: result.confirmed,
            duration_seconds: result.durationSeconds,
            wall_seconds: Math.round((Date.now() - startedAt) / 1000),
            transcript_turns: result.transcript.length,
            error: result.error,
          };
          telemetry.capture("call_ended", props, distinctId);
          // The voice agent shows up in LLM analytics next to the prescription reader.
          // The transcript stays out: the API records the call in Postgres.
          telemetry.llmGeneration({
            traceId: sessionId,
            spanName: "reminder_call",
            provider: "openai",
            model: config.liveModel,
            latencySeconds: result.durationSeconds ?? props.wall_seconds,
            output: [{ role: "assistant", content: `outcome=${result.outcome}` }],
            isError: result.outcome === "failed",
            error: result.error,
            distinctId,
            properties: { dose_id: input.doseId, outcome: result.outcome },
          });
          await service.report(input.doseId, { ...result, checkIn: input.checkIn, recall: input.recall });
          await service.reportLog({
            sessionId,
            kind: input.checkIn ? "check_in" : input.recall ? "recall" : "reminder",
            doseId: input.doseId,
            outcome: result.outcome,
            durationSeconds: result.durationSeconds,
            startedAt: trail.startedAt.toISOString(),
            transcript: result.transcript,
            events: trail.events,
          });
        });
        return json(res, 202, { callId: sessionId });
      } catch (err) {
        if (err instanceof NumberNotAllowedError) {
          telemetry.warn(`call refused: ${err.message}`, { dose_id: input.doseId });
          telemetry.capture("call_refused", { dose_id: input.doseId, reason: "number_not_allowed" }, distinctId);
          return json(res, 403, { error: err.message });
        }
        telemetry.error(`failed to start call: ${(err as Error).message}`, { dose_id: input.doseId });
        telemetry.captureException(err, { dose_id: input.doseId }, distinctId);
        telemetry.capture("call_start_failed", { dose_id: input.doseId, error: (err as Error).message }, distinctId);
        return json(res, 502, { error: "failed to start call" });
      }
    }

    if (req.method === "POST" && url.pathname === "/alert-calls") {
      const b = ((await readJson(req)) ?? {}) as Record<string, unknown>;
      if (typeof b.phone !== "string" || !b.phone) return json(res, 400, { error: "phone is required" });
      if (typeof b.message !== "string" || !b.message.trim() || b.message.length > 600) {
        return json(res, 400, { error: "message is required (at most 600 characters)" });
      }
      const props = { dose_id: typeof b.doseId === "string" ? b.doseId : undefined };
      try {
        const { sessionId, call, trail } = await service.startAlert(b.phone, b.message.trim());
        telemetry.capture("alert_call_started", { ...props, call_id: sessionId }, telemetry.systemId);
        const memberId = typeof b.memberId === "string" ? b.memberId : undefined;
        void call.result.then(async (result) => {
          telemetry.info(`alert call ${sessionId} ended: delivered=${result.delivered}`, { ...props, call_id: sessionId });
          telemetry.capture(
            "alert_call_ended",
            { ...props, call_id: sessionId, answered: result.answered, delivered: result.delivered, end_reason: result.endReason },
            telemetry.systemId,
          );
          void service.reportLog({
            sessionId,
            kind: "caregiver",
            doseId: props.dose_id,
            outcome: result.delivered ? "delivered" : result.answered ? "answered" : "no_answer",
            durationSeconds: result.durationSeconds,
            startedAt: trail.startedAt.toISOString(),
            transcript: result.spoken ? [{ speaker: "assistant", text: result.spoken }] : [],
            events: trail.events,
          });
          // The API calls the next caregiver when this one did not hear the message.
          if (props.dose_id && memberId) {
            await service.reportAlert(props.dose_id, {
              sessionId,
              memberId,
              message: (b.message as string).trim(),
              answered: result.answered,
              delivered: result.delivered,
            });
          }
        });
        return json(res, 202, { callId: sessionId });
      } catch (err) {
        if (err instanceof NumberNotAllowedError) return json(res, 403, { error: err.message });
        telemetry.error(`failed to start alert call: ${(err as Error).message}`, props);
        return json(res, 502, { error: "failed to start alert call" });
      }
    }

    if (req.method === "POST" && url.pathname === "/pharmacy-calls") {
      let input;
      try {
        input = parsePharmacyCallRequest(await readJson(req));
      } catch (err) {
        return json(res, 400, { error: (err as Error).message });
      }
      const distinctId = input.familyId ?? telemetry.systemId;
      const props = { inquiry_id: input.inquiryId, medications: input.medications.length };
      try {
        const { sessionId, call, trail } = await service.startPharmacy(input);
        const record: PharmacyCallRecord = { inquiryId: input.inquiryId, call };
        pharmacyCalls.set(sessionId, record);
        telemetry.capture("pharmacy_call_started", { ...props, call_id: sessionId }, distinctId);
        void call.result.then(async (result) => {
          record.result = result;
          telemetry.info(`pharmacy call ${sessionId} ended: ${result.outcome}`, { inquiry_id: input.inquiryId });
          telemetry.capture(
            "pharmacy_call_ended",
            {
              ...props,
              call_id: sessionId,
              outcome: result.outcome,
              items_with_price: result.items.filter((i) => i.priceCents != null).length,
              keys_pressed: result.keysPressed.length,
              duration_seconds: result.durationSeconds,
              end_reason: result.endReason,
              error: result.error,
            },
            distinctId,
          );
          telemetry.llmGeneration({
            traceId: sessionId,
            spanName: "pharmacy_call",
            provider: "openai",
            model: config.liveModel,
            latencySeconds: result.durationSeconds ?? 0,
            output: [{ role: "assistant", content: `outcome=${result.outcome}` }],
            isError: result.outcome === "failed",
            error: result.error,
            distinctId,
            properties: { inquiry_id: input.inquiryId, outcome: result.outcome },
          });
          await service.reportPharmacy(input.inquiryId, result);
          await service.reportLog({
            sessionId,
            kind: "pharmacy",
            inquiryId: input.inquiryId,
            outcome: result.outcome,
            durationSeconds: result.durationSeconds,
            startedAt: trail.startedAt.toISOString(),
            transcript: result.transcript,
            events: trail.events,
          });
        });
        return json(res, 202, { callId: sessionId });
      } catch (err) {
        if (err instanceof NumberNotAllowedError) {
          telemetry.warn(`pharmacy call refused: ${err.message}`, { inquiry_id: input.inquiryId });
          telemetry.capture("pharmacy_call_refused", { ...props, reason: "number_not_allowed" }, distinctId);
          return json(res, 403, { error: err.message });
        }
        telemetry.error(`failed to start pharmacy call: ${(err as Error).message}`, { inquiry_id: input.inquiryId });
        telemetry.captureException(err, { inquiry_id: input.inquiryId }, distinctId);
        return json(res, 502, { error: "failed to start call" });
      }
    }

    const pharmacyMatch = url.pathname.match(/^\/pharmacy-calls\/([^/]+)$/);
    if (req.method === "GET" && pharmacyMatch) {
      const record = pharmacyCalls.get(decodeURIComponent(pharmacyMatch[1]));
      if (!record) return json(res, 404, { error: "not found" });
      return json(res, 200, { inquiryId: record.inquiryId, status: record.call.status, result: record.result });
    }

    const match = url.pathname.match(/^\/calls\/([^/]+)$/);
    if (req.method === "GET" && match) {
      const record = calls.get(decodeURIComponent(match[1]));
      if (!record) return json(res, 404, { error: "not found" });
      return json(res, 200, { doseId: record.doseId, status: record.call.status, result: record.result });
    }

    return json(res, 404, { error: "not found" });
  } catch (err) {
    telemetry.error(`internal error: ${(err as Error).message}`, { path: url.pathname });
    telemetry.captureException(err, { path: url.pathname });
    return json(res, 500, { error: "internal error" });
  }
});

const port = config?.port ?? Number(process.env.PORT ?? 5000);
server.listen(port, () => {
  telemetry.info(`voice service listening on :${port}`);
  telemetry.capture("service_started", { configured: Boolean(service), telemetry: telemetry.enabled });
});

// Coolify stops the container with SIGTERM: send what is buffered first.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    server.close();
    void telemetry.shutdown().finally(() => process.exit(0));
  });
}

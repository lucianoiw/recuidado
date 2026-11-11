import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { PrescriptionReadError, readPrescription } from "../src/read-prescription.ts";
import type { PrescriptionReading } from "../src/schema.ts";

const sampleReading: PrescriptionReading = {
  is_prescription: true,
  legibility: "good",
  issued_on: "2026-11-03",
  patient_name: "Maria Helena Duarte",
  prescriber_name: "Ricardo Albuquerque Lima",
  prescriber_registry: "CRM-SP 000001",
  items: [
    {
      raw_text: "Rosuvastatina cálcica 10 mg. Tomar 1 comprimido à noite. Uso contínuo.",
      medication_name: "Rosuvastatina cálcica",
      active_ingredient: "rosuvastatina cálcica",
      is_brand_name: false,
      strength: { value: 10, unit: "mg", text: "10 mg" },
      dosage_form: "tablet",
      route: "oral",
      dose_per_intake: 1,
      dose_unit: "tablet",
      frequency: { times_per_day: 1, interval_hours: null, as_needed: false, text: "1 comprimido à noite" },
      schedule: [{ time: "21:00", amount: 1, anchor: "night" }],
      schedule_source: "inferred",
      duration: { continuous: true, days: null },
      quantity_prescribed: "30 comprimidos",
      instructions: null,
      confidence: "high",
      needs_review: false,
      review_reason: null,
    },
  ],
  other_instructions: [],
  warnings: [],
};

/** Client whose HTTP layer returns a canned Messages response and records the request. */
function fakeClient(stopReason: string, text: string) {
  const requests: { url: string; headers: Headers; body: Record<string, any> }[] = [];
  const client = new Anthropic({
    apiKey: "test-key",
    maxRetries: 0,
    fetch: async (url, init) => {
      requests.push({
        url: String(url),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)),
      });
      return new Response(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-opus-5-5",
          content: [{ type: "text", text }],
          stop_reason: stopReason,
          stop_sequence: null,
          stop_details: null,
          usage: { input_tokens: 1500, output_tokens: 400 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });
  return { client, requests };
}

const image = { data: Buffer.from("fake-png-bytes"), mediaType: "image/png" as const };

describe("readPrescription", () => {
  it("sends the image with structured output and fallback, and normalizes the result", async () => {
    const { client, requests } = fakeClient("end_turn", JSON.stringify(sampleReading));
    const result = await readPrescription(image, { client });

    const { body, headers } = requests[0]!;
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.fallbacks).toBe("default");
    expect(headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(body.output_config.effort).toBe("high");
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.output_config.format.schema.properties.items).toBeDefined();
    expect(body.messages[0].content[0]).toMatchObject({
      type: "image",
      source: { type: "base64", media_type: "image/png" },
    });

    expect(result.reading.items[0]!.match_key).toBe("rosuvastatina 10 mg");
    expect(result.reading.items[0]!.monthly_units).toBe(30);
    expect(result.usage).toEqual({ input_tokens: 1500, output_tokens: 400 });
  });

  it("raises a typed error on refusal", async () => {
    const { client } = fakeClient("refusal", "");
    await expect(readPrescription(image, { client })).rejects.toMatchObject({ code: "refused" });
  });

  it("rejects images above the API limit before calling it", async () => {
    const { client, requests } = fakeClient("end_turn", "{}");
    const big = { data: Buffer.alloc(6 * 1024 * 1024), mediaType: "image/jpeg" as const };
    await expect(readPrescription(big, { client })).rejects.toBeInstanceOf(PrescriptionReadError);
    expect(requests).toHaveLength(0);
  });
});

describe("readPrescription output validation", () => {
  it("raises invalid_output when the JSON does not match the schema", async () => {
    const { client } = fakeClient("end_turn", JSON.stringify({ items: "nope" }));
    await expect(readPrescription(image, { client })).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("raises truncated on max_tokens", async () => {
    const { client } = fakeClient("max_tokens", '{"is_prescription": tr');
    await expect(readPrescription(image, { client })).rejects.toMatchObject({ code: "truncated" });
  });
});

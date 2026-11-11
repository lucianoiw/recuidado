import { describe, expect, it, vi } from "vitest";
import { OtlpLogExporter, Telemetry, toOtlpAttributes } from "../src/index.ts";

describe("toOtlpAttributes", () => {
  it("maps types and drops empty values", () => {
    expect(toOtlpAttributes({ a: "x", b: 2, c: 1.5, d: true, e: undefined, f: null })).toEqual([
      { key: "a", value: { stringValue: "x" } },
      { key: "b", value: { intValue: "2" } },
      { key: "c", value: { doubleValue: 1.5 } },
      { key: "d", value: { boolValue: true } },
    ]);
  });
});

describe("OtlpLogExporter", () => {
  it("sends buffered records as one OTLP JSON request with the token", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const exporter = new OtlpLogExporter({
      url: "https://example.test/i/v1/logs",
      token: "phc_test",
      resource: { "service.name": "api" },
      fetch: fetchMock as unknown as typeof fetch,
    });
    exporter.emit("info", "hello", { dose_id: "d1" }, new Date(1000));
    exporter.emit("error", "boom");
    await exporter.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.test/i/v1/logs");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer phc_test");
    const body = JSON.parse(String(init.body));
    const records = body.resourceLogs[0].scopeLogs[0].logRecords;
    expect(body.resourceLogs[0].resource.attributes).toEqual([{ key: "service.name", value: { stringValue: "api" } }]);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      timeUnixNano: "1000000000",
      severityText: "INFO",
      severityNumber: 9,
      body: { stringValue: "hello" },
    });
    expect(records[1].severityNumber).toBe(17);
  });

  it("does not throw when the endpoint fails", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const exporter = new OtlpLogExporter({
      url: "https://example.test/i/v1/logs",
      token: "t",
      resource: {},
      fetch: (async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch,
    });
    exporter.emit("warn", "x");
    await expect(exporter.flush()).resolves.toBeUndefined();
    stderr.mockRestore();
  });
});

describe("Telemetry", () => {
  it("is a no-op without a token", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const t = new Telemetry({ service: "api" });
    expect(t.enabled).toBe(false);
    t.capture("dose_confirmed", { dose_id: "d1" });
    t.captureException(new Error("x"));
    t.info("still printed", { dose_id: "d1" });
    await t.shutdown();
    expect(log).toHaveBeenCalledWith("still printed dose_id=d1");
    log.mockRestore();
  });
});

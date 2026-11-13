import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UsageMeter } from "./usage.js";

describe("UsageMeter", () => {
  it("keeps the last voice seconds, the answered time and each backend response once", async () => {
    let now = 1_000;
    const meter = new UsageMeter(() => now);
    meter.handle({ type: "session.usage.updated", usage: { seconds: 5 } });
    meter.handle({ type: "transport.answered" });
    now = 31_000;
    const completed = {
      type: "response.event",
      event: {
        type: "response.completed",
        response: { id: "resp_1", model: "gpt-6-luna", usage: { input_tokens: 3000, output_tokens: 120, input_tokens_details: { cached_tokens: 2000 } } },
      },
    };
    meter.handle(completed);
    meter.handle(completed);
    meter.handle({ type: "session.usage.updated", usage: { seconds: 40 } });
    meter.handle({ type: "session.closed", usage: { seconds: 42 } });
    now = 60_000;
    const usage = await meter.settle(10);
    assert.deepEqual(usage, {
      voiceSeconds: 42,
      answeredSeconds: 30,
      backend: [{ model: "gpt-6-luna", responses: 1, inputTokens: 3000, cachedTokens: 2000, outputTokens: 120 }],
    });
  });

  it("reports zero answered seconds when nobody picked up", async () => {
    const meter = new UsageMeter();
    meter.handle({ type: "session.closed", usage: { seconds: 25 } });
    assert.equal((await meter.settle(10)).answeredSeconds, 0);
  });
});

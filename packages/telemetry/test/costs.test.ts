import { describe, expect, it } from "vitest";
import { telephonyCost, tokenCost, voiceCost } from "../src/costs.ts";

describe("costs", () => {
  it("prices Anthropic tokens with cache tokens apart from input", () => {
    // 1000 input * 2 + 10000 cache read * 0.1 + 500 output * 10, per 1M.
    expect(tokenCost("anthropic", "claude-sonnet-5-5", { inputTokens: 1000, cacheReadTokens: 10000, outputTokens: 500 })).toEqual({
      inputUsd: 0.003,
      outputUsd: 0.005,
      totalUsd: 0.008,
    });
  });

  it("prices OpenAI tokens with cached tokens inside input", () => {
    // 8000 fresh * 0.10 + 2000 cached * 0.01 + 1000 output * 0.50, per 1M.
    expect(tokenCost("openai", "gpt-6-luna", { inputTokens: 10000, cacheReadTokens: 2000, outputTokens: 1000 })).toEqual({
      inputUsd: 0.00082,
      outputUsd: 0.0005,
      totalUsd: 0.00132,
    });
  });

  it("knows dated model ids and returns undefined for unknown models", () => {
    expect(tokenCost("anthropic", "claude-opus-5-5-20260922", { inputTokens: 1_000_000 })?.totalUsd).toBe(4);
    expect(tokenCost("openai", "unknown-model", { inputTokens: 10 })).toBeUndefined();
  });

  it("bills voice by the second", () => {
    expect(voiceCost("gpt-live-1", 90)?.totalUsd).toBe(0.075);
  });

  it("bills the phone line from 30 s, then by 6 s", () => {
    expect(telephonyCost(0)).toEqual({ billedSeconds: 0, brl: 0, usd: 0 });
    expect(telephonyCost(12).billedSeconds).toBe(30);
    expect(telephonyCost(31)).toEqual({ billedSeconds: 36, brl: 0.27, usd: 0.048128 });
  });
});

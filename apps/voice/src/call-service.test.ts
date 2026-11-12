import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowed } from "./call-service.js";

test("only listed numbers by default", () => {
  const config = { allowedNumbers: new Set(["+5511900000001"]), allowAnyBrazilian: false };
  assert.equal(isAllowed(config, "+5511900000001"), true);
  assert.equal(isAllowed(config, "+5511900000002"), false);
});

test("\"*\" allows any Brazilian number but never an international one", () => {
  const config = { allowedNumbers: new Set<string>(), allowAnyBrazilian: true };
  assert.equal(isAllowed(config, "+5521900000003"), true);
  assert.equal(isAllowed(config, "+14155550100"), false);
});

test("call trail keeps log lines as the timeline, without the time and session prefix", async () => {
  const { CallTrail } = await import("./call-service.js");
  const printed: string[] = [];
  const trail = new CallTrail((m) => printed.push(m));
  trail.log("2026-11-11T22:50:05.948Z [live_abc] dose answer recorded: taken=false");
  trail.log("[live_abc] recording started (PJSIP/openai-1)");
  assert.deepEqual(trail.events.map((e) => e.text), ["dose answer recorded: taken=false", "recording started (PJSIP/openai-1)"]);
  assert.equal(printed.length, 2);
  assert.ok(trail.events[0].atMs >= 0);
});

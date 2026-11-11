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

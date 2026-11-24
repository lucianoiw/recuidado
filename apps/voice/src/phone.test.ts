import { test } from "node:test";
import assert from "node:assert/strict";
import { toE164 } from "./phone.js";

test("normalizes Brazilian numbers", () => {
  assert.equal(toE164("(11) 91234-5678"), "+5511912345678");
  assert.equal(toE164("5511912345678"), "+5511912345678");
  assert.equal(toE164("011912345678"), "+5511912345678");
  assert.equal(toE164("+55 11 3456-7890"), "+551134567890");
});

test("a simulated patient typed in the app keeps its zeros", () => {
  assert.equal(toE164("00000000021"), "+5500000000021");
  assert.equal(toE164("+5500000000021"), "+5500000000021");
});

test("rejects numbers without DDD", () => {
  assert.throws(() => toE164("912345678"));
});

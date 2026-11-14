import { test } from "node:test";
import assert from "node:assert/strict";
import { toLines } from "./transcribe.js";

test("the speaker who introduces itself as the Recuidado assistant is the assistant; pieces are joined", () => {
  const lines = toLines([
    { speaker: "A", text: "Drogaria Vida, boa noite.", start: 1.2, end: 2 },
    { speaker: "B", text: "Oi, boa noite! Aqui é a assistente virtual da Recuidado.", start: 2.5, end: 5 },
    { speaker: "B", text: "Vocês têm Losartana?", start: 5.1, end: 6 },
    { speaker: "A", text: "Temos sim, o genérico sai treze e noventa.", start: 7, end: 9 },
    { speaker: "A", text: " ", start: 9, end: 9.2 },
  ]);
  assert.deepEqual(lines, [
    { speaker: "patient", text: "Drogaria Vida, boa noite.", atMs: 1200 },
    { speaker: "assistant", text: "Oi, boa noite! Aqui é a assistente virtual da Recuidado. Vocês têm Losartana?", atMs: 2500 },
    { speaker: "patient", text: "Temos sim, o genérico sai treze e noventa.", atMs: 7000 },
  ]);
});

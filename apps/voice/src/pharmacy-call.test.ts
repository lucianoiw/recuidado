import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PharmacyCall, menuChoice, spokenChoice, toCents } from "./pharmacy-call.js";
import type { SidebandSocket } from "./reminder-call.js";
import { isAllowedPharmacy } from "./call-service.js";
import { buildPharmacyLiveInstructions, pharmacyOpening, pharmacyTool } from "./pharmacy-prompt.js";
import { LiveClient } from "./live.js";
import type { VoiceConfig } from "./config.js";

class FakeSocket extends EventEmitter implements SidebandSocket {
  sent: Record<string, unknown>[] = [];
  closed = false;
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
  }
  emitEvent(event: Record<string, unknown>) {
    this.emit("message", Buffer.from(JSON.stringify(event)));
  }
}

const context = { medications: [{ name: "Losartana", dose: "50 mg" }, { name: "Sinvastatina", dose: "20 mg" }] };

function setup(openingWaitMs = 60_000) {
  const socket = new FakeSocket();
  let hangups = 0;
  const call = new PharmacyCall({
    sessionId: "live_pharmacy",
    context,
    socket,
    hangup: async () => {
      hangups++;
      socket.emitEvent({ type: "session.closed", event_id: "closed", reason: "close_requested", usage: { seconds: 48 } });
    },
    maxCallMs: 60_000,
    openingWaitMs,
    keyGapMs: 1,
    introduceAfterMs: 5,
    menuPauseMs: 60_000,
    goodbyeMs: 5,
    goodbyeTailMs: 5,
    closeGraceMs: 5,
  });
  return { socket, call, hangups: () => hangups };
}

function fnCall(id: string, name: string, args: unknown) {
  return {
    type: "response.event",
    event_id: `ev_${id}`,
    event: {
      type: "response.output_item.done",
      item: { type: "function_call", name, call_id: id, arguments: JSON.stringify(args) },
    },
  };
}

test("presses a menu key, then records stock and price and hangs up after the goodbye", async () => {
  const { socket, call, hangups } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Para falar com a farmácia, tecle 2." });
  socket.emitEvent(fnCall("k1", "press_phone_keys", { keys: "2" }));
  await new Promise((r) => setTimeout(r, 10));

  const dtmf = socket.sent.filter((e) => e.type === "transport.dtmf.send");
  assert.deepEqual(dtmf.map((e) => e.event), ["2"]);
  const out = socket.sent.find((e) => e.type === "response.item.create") as { item: { output: string } };
  assert.deepEqual(JSON.parse(out.item.output), { pressed: "2", ok: true });

  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i2", delta: "Drogaria, bom dia." });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Oi, bom dia! Aqui é a assistente virtual da Recuidado." });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i3", delta: "Tem sim, 18,90 a caixa com 30." });
  socket.emitEvent(
    fnCall("r1", "record_pharmacy_answer", {
      items: [
        { medication: "Losartana 50 mg", available: "yes", price_reais: 18.9, package: "caixa com 30 comprimidos", farmacia_popular: "yes" },
        { medication: "Sinvastatina 20 mg", available: "no", price_reais: null, package: "", farmacia_popular: "unknown" },
      ],
      note: "",
    }),
  );
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o2", delta: "Muito obrigada, tchau!" });

  const result = await call.result;
  assert.equal(result.outcome, "answered");
  assert.deepEqual(result.keysPressed, ["2"]);
  assert.deepEqual(result.items, [
    { medication: "Losartana 50 mg", available: "yes", priceCents: 1890, package: "caixa com 30 comprimidos", farmaciaPopular: "yes" },
    { medication: "Sinvastatina 20 mg", available: "no", priceCents: null, package: undefined, farmaciaPopular: "unknown" },
  ]);
  assert.equal(result.endReason, "hung_up_after_goodbye");
  assert.equal(result.durationSeconds, 48);
  assert.equal(hangups(), 1);
});

test("sends each digit of a longer key sequence as its own DTMF event", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent(fnCall("k1", "press_phone_keys", { keys: "1#" }));
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(
    socket.sent.filter((e) => e.type === "transport.dtmf.send").map((e) => e.event),
    ["1", "#"],
  );
  await call.endCall();
  assert.equal((await call.result).outcome, "unclear");
});

test("refuses keys outside the keypad", async () => {
  const { socket, call } = setup();
  socket.emitEvent(fnCall("k1", "press_phone_keys", { keys: "123.456.789-00 meu cpf" }));
  assert.equal(socket.sent.filter((e) => e.type === "transport.dtmf.send").length, 0);
  const out = socket.sent.find((e) => e.type === "response.item.create") as { item: { output: string } };
  assert.equal(JSON.parse(out.item.output).ok, false);
  await call.endCall();
  await call.result;
});

test("opens the conversation when nobody speaks after answering", async () => {
  const { socket, call } = setup(5);
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  await new Promise((r) => setTimeout(r, 20));
  const opening = socket.sent.find((e) => e.type === "session.commentary.append") as { content: string } | undefined;
  assert.ok(opening?.content.includes("assistente virtual da Recuidado"));
  await call.endCall();
  await call.result;
});

test("does not open over the other side", async () => {
  const { socket, call } = setup(5);
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Alô?" });
  await new Promise((r) => setTimeout(r, 20));
  // No "silent" opening; only the one introduction for the person who answered.
  const sent = socket.sent.filter((e) => e.type === "session.commentary.append").map((e) => String(e.event_id));
  assert.equal(sent.filter((id) => id.startsWith("opening_")).length, 0);
  assert.ok(sent.length <= 1);
  await call.endCall();
  await call.result;
});

test("voicemail ends the call as no_answer", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Deixe sua mensagem após o sinal." });
  const result = await call.result;
  assert.equal(result.outcome, "no_answer");
  assert.equal(result.endReason, "voicemail");
});

test("prices", () => {
  assert.equal(toCents(18.9), 1890);
  assert.equal(toCents("18,90"), 1890);
  assert.equal(toCents(null), null);
  assert.equal(toCents(0), null);
});

test("only numbers listed one by one may be called as a pharmacy", () => {
  const config = { allowedNumbers: new Set(["+5511912345678"]) };
  assert.equal(isAllowedPharmacy(config, "+5511912345678"), true);
  assert.equal(isAllowedPharmacy(config, "+5511900000000"), false);
});

test("the assistant says it is a virtual assistant in its first line", () => {
  assert.match(pharmacyOpening(context), /assistente virtual da Recuidado/);
  assert.match(pharmacyOpening(context), /Losartana 50 mg/);
  assert.match(buildPharmacyLiveInstructions(context), /never pretend to be a person/);
});

test("pharmacy session has no greeting input and both tools", () => {
  const config = {
    openaiApiKey: "k",
    liveModel: "gpt-live-1",
    liveVoice: "bossa",
    delegateModel: "gpt-6-luna",
    sip: { providerUrl: "sips:x:5061", username: "openai", password: "p", callerNumber: "+551100000000" },
    allowedNumbers: new Set<string>(),
    allowAnyBrazilian: false,
    maxCallSeconds: 150,
    port: 0,
    voiceApiToken: "t",
  } satisfies VoiceConfig;
  const req = new LiveClient(config).buildPharmacySessionRequest("+5511912345678", context);
  assert.equal("input" in req.session, false);
  assert.deepEqual(
    req.session.delegation.responses.tools.map((t) => t.name),
    ["press_phone_keys", pharmacyTool.name],
  );
  assert.equal(req.transport.destination, "+5511912345678");
});

test("presses the key itself when the assistant says the option aloud instead of delegating", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Para preço e estoque de remédios, tecle dois. Para outros assuntos, tecle" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Opção" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i2", delta: "nove" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o2", delta: " 2." });
  assert.deepEqual(
    socket.sent.filter((e) => e.type === "transport.dtmf.send").map((e) => e.event),
    ["2"],
  );
  // Saying it again without a new menu does not press again.
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o3", delta: " Opção 2." });
  assert.equal(socket.sent.filter((e) => e.type === "transport.dtmf.send").length, 1);
  await call.endCall();
  assert.deepEqual((await call.result).keysPressed, ["2"]);
});

test("reads the option the assistant said", () => {
  assert.equal(spokenChoice("Opção 2."), "2");
  assert.equal(spokenChoice("vou teclar dois"), "2");
  assert.equal(spokenChoice("Oi, boa tarde!"), null);
});

test("asks for the introduction when a person talks and the assistant has not said who it is", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Farmácia, boa tarde." });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Um momento." });
  await new Promise((r) => setTimeout(r, 30));
  const intro = socket.sent.filter((e) => e.type === "session.commentary.append") as { content: string }[];
  assert.equal(intro.length, 1);
  assert.match(intro[0].content, /assistente virtual da Recuidado/);
  await call.endCall();
  await call.result;
});

test("does not repeat the introduction once said", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Oi! Aqui é a assistente virtual da Recuidado." });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Pois não?" });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(socket.sent.filter((e) => e.type === "session.commentary.append").length, 0);
  await call.endCall();
  await call.result;
});

test("does not introduce itself to a menu that arrives in pieces", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Bem-vindo à Farmácia" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Oi," });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i2", delta: "Para preço" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o2", delta: "bom dia" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i3", delta: "tecle dois" });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(socket.sent.filter((e) => e.type === "session.commentary.append").length, 0);
  await call.endCall();
  await call.result;
});

test("picks the menu option by rule", () => {
  const menu = "Bem-vindo a Farmácia Pate. Para receita medicamentos tecle1. Para preçoestoque de remédios, tecle 2 Para outros assuntos, tecle9";
  assert.equal(menuChoice(menu), "2");
  assert.equal(menuChoice("Para falar com um atendente, digite zero. Para delivery, digite um."), "0");
  assert.equal(menuChoice("Para delivery, tecle 1. Para trabalhe conosco, tecle 2."), null);
});

test("presses the menu key itself after the menu pauses", async () => {
  const socket = new FakeSocket();
  const call = new PharmacyCall({
    sessionId: "live_menu",
    context,
    socket,
    hangup: async () => socket.emitEvent({ type: "session.closed", event_id: "closed", reason: "close_requested" }),
    maxCallMs: 60_000,
    openingWaitMs: 60_000,
    introduceAfterMs: 60_000,
    menuPauseMs: 5,
    keyGapMs: 1,
    closeGraceMs: 5,
  });
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Para receita, tecle 1. Para preço e estoque, tecle 2." });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(socket.sent.filter((e) => e.type === "transport.dtmf.send").map((e) => e.event), ["2"]);
  // The model asking for the same key right after is dropped.
  socket.emitEvent(fnCall("k9", "press_phone_keys", { keys: "2" }));
  assert.equal(socket.sent.filter((e) => e.type === "transport.dtmf.send").length, 1);
  await call.endCall();
  assert.deepEqual((await call.result).keysPressed, ["2"]);
});

test("waits for the other side to pause before introducing, so a slow menu is not taken for a person", async () => {
  const socket = new FakeSocket();
  const call = new PharmacyCall({
    sessionId: "live_slow_menu",
    context,
    socket,
    hangup: async () => socket.emitEvent({ type: "session.closed", event_id: "closed", reason: "close_requested" }),
    maxCallMs: 60_000,
    openingWaitMs: 60_000,
    introduceAfterMs: 50,
    menuPauseMs: 60_000,
    closeGraceMs: 5,
  });
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  for (const [i, delta] of ["Bem-vindo à Farmácia Pet.", " Para receita", " de", " documentos", " tecle um"].entries()) {
    socket.emitEvent({ type: "session.input_transcript.delta", event_id: `i${i}`, delta });
    await new Promise((r) => setTimeout(r, 20));
  }
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(socket.sent.filter((e) => e.type === "session.commentary.append").length, 0);
  await call.endCall();
  await call.result;
});

test("hangs up soon when the goodbye came before the answer was recorded", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Oi! Aqui é a assistente virtual da Recuidado." });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Tem sim, 18,90." });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o2", delta: "Muito obrigada, tchau!" });
  socket.emitEvent(
    fnCall("r1", "record_pharmacy_answer", {
      items: [{ medication: "Losartana 50 mg", available: "yes", price_reais: 18.9, package: "", farmacia_popular: "unknown" }],
      note: "",
    }),
  );
  const result = await call.result;
  assert.equal(result.outcome, "answered");
  assert.equal(result.endReason, "hung_up_after_goodbye");
});

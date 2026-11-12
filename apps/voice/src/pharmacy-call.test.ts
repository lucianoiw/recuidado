import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PharmacyCall, menuChoice, sideByRule, spokenChoice, toCents } from "./pharmacy-call.js";
import type { VoiceGate } from "./ami.js";
import { defaultGateway } from "./ami.js";
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

class FakeGate implements VoiceGate {
  states: string[] = [];
  async mute() {
    this.states.push("muted");
  }
  async unmute() {
    this.states.push("heard");
  }
  get last() {
    return this.states.at(-1);
  }
}

function setup(openingWaitMs = 60_000, extra: Partial<ConstructorParameters<typeof PharmacyCall>[0]> = {}) {
  const socket = new FakeSocket();
  const gate = new FakeGate();
  let hangups = 0;
  const call = new PharmacyCall({
    sessionId: "live_pharmacy",
    context,
    socket,
    gate,
    hangup: async () => {
      hangups++;
      socket.emitEvent({ type: "session.closed", event_id: "closed", reason: "close_requested", usage: { seconds: 48 } });
    },
    maxCallMs: 60_000,
    openingWaitMs,
    keyGapMs: 1,
    introduceAfterMs: 5,
    introduceConfidentMs: 5,
    menuPauseMs: 60_000,
    goodbyeMs: 5,
    goodbyeTailMs: 5,
    closeGraceMs: 5,
    silentLineMs: 60_000,
    stallMs: 60_000,
    speechCharMs: 1,
    ...extra,
  });
  return { socket, call, gate, hangups: () => hangups };
}

const tick = () => new Promise((r) => setTimeout(r, 20));

function decision(id: string, source: string, side: string, key = "none") {
  return {
    type: "decision.event",
    event_id: id,
    delegation_id: null,
    source_event_type: "session.input_transcript.delta",
    source_event_id: source,
    event: {
      type: "decision.completed",
      decision: { answers: [{ type: "choice", name: "other_side", choice: side }, { type: "choice", name: "menu_key", choice: key }] },
    },
  };
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
  assert.equal(socket.sent.filter((e) => e.type === "response.create").length, 0, "no new response after a key");

  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i2", delta: "Drogaria, bom dia." });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Oi, bom dia! Aqui é a assistente virtual da Recuidado." });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i3", delta: "Tem sim, 18,90 a caixa com 30." });
  socket.emitEvent(
    fnCall("r1", "record_pharmacy_answer", {
      items: [
        { medication: "Losartana 50 mg", available: "yes", generic_price_reais: 18.9, reference_price_reais: 42.5, price_reais: null, package: "caixa com 30 comprimidos" },
        { medication: "Sinvastatina 20 mg", available: "no", generic_price_reais: null, reference_price_reais: null, price_reais: null, package: "" },
      ],
      note: "",
    }),
  );
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o2", delta: "Muito obrigada, tchau!" });

  const result = await call.result;
  assert.equal(result.outcome, "answered");
  assert.deepEqual(result.keysPressed, ["2"]);
  assert.deepEqual(result.items, [
    { medication: "Losartana 50 mg", available: "yes", priceCents: 1890, genericPriceCents: 1890, referencePriceCents: 4250, package: "caixa com 30 comprimidos" },
    { medication: "Sinvastatina 20 mg", available: "no", priceCents: null, genericPriceCents: null, referencePriceCents: null, package: undefined },
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
    actorVoice: "tempo",
    delegateModel: "gpt-6-luna",
    sip: { providerUrl: "sips:x:5061", username: "openai", password: "p", callerNumber: "+551100000000" },
    allowedNumbers: new Set<string>(),
    allowAnyBrazilian: false,
    maxCallSeconds: 150,
    port: 0,
    voiceApiToken: "t",
    pharmacyDecisions: true,
    recordCalls: false,
  } satisfies VoiceConfig;
  const req = new LiveClient(config).buildPharmacySessionRequest("+5511912345678", context);
  assert.equal("input" in req.session, false);
  assert.equal((req.session as { triggers?: unknown[] }).triggers?.length, 1);
  assert.equal("triggers" in new LiveClient({ ...config, pharmacyDecisions: false }).buildPharmacySessionRequest("+5511912345678", context).session, false);
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
  await new Promise((r) => setTimeout(r, 1000));
  const intro = socket.sent.filter((e) => e.type === "session.commentary.append") as { content: string }[];
  assert.equal(intro.length, 1);
  assert.match(intro[0].content, /assistente virtual da Recuidado/);
  await call.endCall();
  await call.result;
});

test("does not repeat the introduction once said", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Farmácia, boa tarde." });
  await new Promise((r) => setTimeout(r, 30));
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Oi! Aqui é a assistente virtual da Recuidado." });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i2", delta: "Pois não?" });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(socket.sent.filter((e) => e.type === "session.commentary.append").length, 1);
  await call.endCall();
  await call.result;
});

test("an introduction said while the AI was muted did not reach the pharmacy: it is asked for again", async () => {
  const { socket, call, gate } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Oi! Aqui é a assistente virtual da Recuidado." });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Drogaria Bom Preço, bom dia, Paulo falando." });
  await new Promise((r) => setTimeout(r, 1000));
  const intro = socket.sent.filter((e) => e.type === "session.commentary.append") as { content: string }[];
  assert.equal(intro.length, 1);
  assert.match(intro[0].content, /assistente virtual da Recuidado/);
  assert.match(intro[0].content, /did not hear/);
  assert.equal(gate.last, "heard");
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
      items: [{ medication: "Losartana 50 mg", available: "yes", price_reais: 18.9, package: "" }],
      note: "",
    }),
  );
  const result = await call.result;
  assert.equal(result.outcome, "answered");
  assert.equal(result.endReason, "hung_up_after_goodbye");
});

test("a stray menu word after the key press does not block the introduction", async () => {
  const socket = new FakeSocket();
  const call = new PharmacyCall({
    sessionId: "live_stray",
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
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Para preço e estoque, tecle 2." });
  await new Promise((r) => setTimeout(r, 20));
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i2", delta: " Tecle. Boa tarde, sim, temos." });
  await new Promise((r) => setTimeout(r, 20));
  const intro = socket.sent.filter((e) => e.type === "session.commentary.append") as { content: string }[];
  assert.equal(intro.length, 1);
  assert.match(intro[0].content, /assistente virtual/);
  await call.endCall();
  await call.result;
});

test("word rules: menu, hold, wait, closed, voicemail; a greeting is not classified", () => {
  assert.equal(sideByRule("Para preço, tecle 2", "Para preço, tecle 2"), "menu");
  assert.equal(sideByRule("Todos os nossos atendentes estão ocupados", ""), "hold");
  assert.equal(sideByRule("Farmácia Teste, boa tarde. Só um minutinho, por favor", ""), "person_wait");
  assert.equal(sideByRule("Nosso horário de atendimento é das oito às vinte e duas", ""), "closed");
  assert.equal(sideByRule("Deixe sua mensagem após o sinal", ""), "voicemail");
  assert.equal(sideByRule("Farmácia Teste, boa tarde.", ""), null);
  assert.equal(sideByRule("Aguarde um pouquinho que eu vejo", ""), null);
});

test("default gateway is read from the route table", () => {
  const table = "Iface\tDestination\tGateway\tFlags\neth0\t00000000\t0101000A\t0003\neth0\t0001000A\t00000000\t0001\n";
  assert.equal(defaultGateway(table), "10.0.1.1");
  assert.equal(defaultGateway(""), undefined);
});

test("the AI is muted from the answer until a person speaks, then introduces itself", async () => {
  const { socket, gate } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  await tick();
  assert.equal(gate.last, "muted");
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Farmácia Teste, boa tarde." });
  socket.emitEvent(decision("d1", "i1", "person"));
  await tick();
  assert.equal(gate.last, "heard");
  const intro = socket.sent.filter((e) => e.type === "session.commentary.append") as { content: string }[];
  assert.equal(intro.length, 1);
  assert.match(intro[0].content, /assistente virtual da Recuidado/);
});

test("hold message keeps the AI muted and does not introduce", async () => {
  const { socket, gate } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Todos os nossos atendentes estão ocupados. Por favor, aguarde na linha." });
  await tick();
  assert.equal(gate.last, "muted");
  assert.equal(socket.sent.filter((e) => e.type === "session.commentary.append").length, 0);
});

test("a person asking to wait hears 'Claro, eu aguardo', then the AI is muted until they are back", async () => {
  const { socket, gate } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Farmácia Teste, boa tarde. Só um minutinho, por favor." });
  await tick();
  assert.equal(gate.last, "heard");
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Claro, eu aguardo." });
  await new Promise((r) => setTimeout(r, 1600));
  assert.equal(gate.last, "muted");
  assert.equal(socket.sent.filter((e) => e.type === "session.commentary.append").length, 0);
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i2", delta: "Pronto, desculpa a demora." });
  socket.emitEvent(decision("d2", "i2", "person"));
  await tick();
  assert.equal(gate.last, "heard");
  assert.equal(socket.sent.filter((e) => e.type === "session.commentary.append").length, 1);
});

test("closed pharmacy: hangs up with no answer and a note", async () => {
  const { socket, call, hangups } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Nosso horário de atendimento é de segunda a sábado." });
  const result = await call.result;
  assert.equal(hangups(), 1);
  assert.equal(result.outcome, "no_answer");
  assert.equal(result.endReason, "closed");
  assert.match(result.note ?? "", /fechada/);
});

test("an option only the second model understands is chosen by it", async () => {
  const socket = new FakeSocket();
  new PharmacyCall({
    sessionId: "live_pharmacy",
    context,
    socket,
    gate: new FakeGate(),
    hangup: async () => {},
    maxCallMs: 60_000,
    openingWaitMs: 60_000,
    introduceAfterMs: 60_000,
    menuPauseMs: 5,
    keyGapMs: 1,
  });
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Para receitas, tecle 1. Para falar com o farmacêutico, tecle 3." });
  socket.emitEvent(decision("d1", "i1", "menu", "3"));
  await tick();
  const keys = socket.sent.filter((e) => e.type === "transport.dtmf.send").map((e) => e.event);
  assert.deepEqual(keys, ["3"]);
});

test("a late Decisions answer about an older utterance is ignored", async () => {
  const { socket, gate } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Farmácia Teste," });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i2", delta: " boa tarde." });
  socket.emitEvent(decision("d2", "i2", "person"));
  socket.emitEvent(decision("d1", "i1", "hold"));
  await tick();
  assert.equal(gate.last, "heard");
});

function quickMenuCall() {
  const socket = new FakeSocket();
  const gate = new FakeGate();
  new PharmacyCall({
    sessionId: "live_pharmacy",
    context,
    socket,
    gate,
    hangup: async () => {},
    maxCallMs: 60_000,
    openingWaitMs: 60_000,
    introduceAfterMs: 30,
    introduceConfidentMs: 30,
    menuPauseMs: 30,
    keyGapMs: 1,
  });
  return { socket, gate };
}
const keysSent = (socket: FakeSocket) => socket.sent.filter((e) => e.type === "transport.dtmf.send").map((e) => e.event);

test("the tail of the menu after the key, then the attendant: no second key, the AI introduces itself", async () => {
  const { socket, gate } = quickMenuCall();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Para preço e estoque de remédios, tecle 2." });
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(keysSent(socket), ["2"]);
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i2", delta: "Tecle 9. Farmácia Teste, boa tarde." });
  socket.emitEvent(decision("d2", "i2", "person", "2"));
  await new Promise((r) => setTimeout(r, 120));
  assert.deepEqual(keysSent(socket), ["2"]);
  assert.equal(socket.sent.filter((e) => e.type === "session.commentary.append").length, 1);
  assert.equal(gate.last, "heard");
});

test("a key the menu did not offer is never pressed, even if the second model suggests it", async () => {
  const { socket } = quickMenuCall();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Bem-vindo. Para receitas, digite" });
  socket.emitEvent(decision("d1", "i1", "menu", "0"));
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(keysSent(socket), []);
});

test("a pharmacy named Bom Preço does not make the first option look like prices", () => {
  const menu =
    "Olá, você ligou para a drogaria bom preço Para entregas, tecle um. Para trocas, tecle dois. Para falar com um atendente da farmácia, tecle 3";
  assert.equal(menuChoice(menu), "3");
  assert.equal(menuChoice("Se você quer saber o preço, tecle 2. Para outros assuntos, tecle 9"), "2");
});

test("a recorded welcome is a menu, not a person", () => {
  assert.equal(sideByRule("Olá, você ligou para a Drogaria Bom Preço", ""), "menu");
  assert.equal(sideByRule("Bem-vindo à Farmácia Teste", ""), "menu");
  assert.equal(sideByRule("Farmácia Central, boa noite, Marcos falando", ""), null);
});

test("a recorded welcome before the options: stays muted and waits, no introduction over the menu", async () => {
  const { socket, gate } = quickMenuCall();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Olá, você ligou para a Drogaria Bom Preço." });
  socket.emitEvent(decision("d1", "i1", "person", "none"));
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(socket.sent.filter((e) => e.type === "session.commentary.append").length, 0);
  assert.equal(gate.last, "muted");
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i2", delta: " Para entregas, tecle 1. Para falar com um atendente, tecle 3." });
  await new Promise((r) => setTimeout(r, 120));
  assert.deepEqual(keysSent(socket), ["3"]);
});

test("a goodbye ends the call even when the answer tool never ran, and no 'Alô?' after it", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Drogaria, boa noite." });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Oi, boa noite! Aqui é a assistente virtual da Recuidado." });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i2", delta: "Tem sim, dez e noventa." });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o2", delta: "Perfeito. Muito obrigada, tchau!" });
  const result = await call.result;
  assert.equal(result.endReason, "hung_up_after_goodbye");
  const nudges = (socket.sent as { event_id?: string }[]).filter((e) => e.event_id?.startsWith("nudge_"));
  assert.equal(nudges.length, 0);
});

test("silence after the hold message: the AI is heard and says only 'Alô?'", async () => {
  const { socket, call, gate } = setup(60_000, { silentLineMs: 20 });
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Para falar com um atendente, tecle 3." });
  socket.emitEvent(fnCall("k1", "press_phone_keys", { keys: "3" }));
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i2", delta: "Nossos atendentes estão ocupados. Por favor, aguarde na linha." });
  await new Promise((r) => setTimeout(r, 60));
  const alo = socket.sent.filter((e) => e.type === "session.commentary.append") as { content: string }[];
  assert.ok(alo.length >= 1);
  assert.match(alo[0].content, /Alô\?/);
  assert.equal(gate.last, "heard");
  await call.endCall();
  await call.result;
});

test("overlapping speech keeps whole lines; what the AI said while muted stays out of the transcript", async () => {
  const { socket, call } = setup(60_000, { overlapGlueMs: 25 });
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o0", delta: "Oi, bom dia!" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Farmácia Central, bom dia." });
  await new Promise((r) => setTimeout(r, 1000));
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Aqui é a assistente virtual da Rec" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i2", delta: "Pois" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o2", delta: "uidado." });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i3", delta: " não?" });
  await call.endCall();
  const result = await call.result;
  assert.deepEqual(result.transcript, [
    { speaker: "patient", text: "Farmácia Central, bom dia." },
    { speaker: "assistant", text: "Aqui é a assistente virtual da Recuidado." },
    { speaker: "patient", text: "Pois não?" },
  ]);
});

test("the assistant goes silent after the pharmacy answered: one nudge, then the call ends", async () => {
  const { socket, call } = setup(60_000, { stallMs: 20 });
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Drogaria, boa tarde." });
  await new Promise((r) => setTimeout(r, 30));
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Aqui é a assistente virtual da Recuidado. Vocês têm Losartana?" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i2", delta: "Tem sim, dez e noventa." });
  const result = await call.result;
  assert.equal(result.endReason, "assistant_silent");
  const stall = (socket.sent as { event_id?: string }[]).filter((e) => e.event_id?.startsWith("stall_"));
  assert.equal(stall.length, 1);
});

test("the introduction waits until the model stops its own muted introduction", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Drogaria Vida, boa tarde." });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Oi, boa tarde! Aqui é a assistente" });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(socket.sent.filter((e) => e.type === "session.commentary.append").length, 0, "not while it talks");
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal(socket.sent.filter((e) => e.type === "session.commentary.append").length, 1);
  await call.endCall();
  await call.result;
});

test("nothing heard after the introduction: the call ends as a silent line", async () => {
  const { socket, call } = setup(5, { deadLineMs: 40 });
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  const result = await call.result;
  assert.equal(result.endReason, "silent_line");
  const again = (socket.sent as { event_id?: string }[]).filter((e) => e.event_id?.startsWith("ask_again_"));
  assert.equal(again.length, 1);
});

test("nothing heard after a menu key: 'Alô?' three times, then the call ends as a silent line", async () => {
  const { socket, call } = setup(60_000, { silentLineMs: 20 });
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Para preço e estoque de remédios, tecle 2." });
  socket.emitEvent(fnCall("k1", "press_phone_keys", { keys: "2" }));
  const result = await call.result;
  assert.equal(result.endReason, "silent_line");
  const alo = (socket.sent as { event_id?: string }[]).filter((e) => e.event_id?.startsWith("alo_"));
  assert.equal(alo.length, 3);
});

test("answer recorded without a goodbye: the AI is asked for it once, then the call ends", async () => {
  const { socket, call } = setup(60_000);
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Farmácia Central, boa tarde. Tem sim, sete e noventa." });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Ok, só um instante." });
  socket.emitEvent(
    fnCall("r1", "record_pharmacy_answer", {
      items: [{ medication: "Losartana 50 mg", available: "yes", generic_price_reais: 7.9, reference_price_reais: 13.9, price_reais: null, package: "" }],
      note: "",
    }),
  );
  const result = await call.result;
  assert.equal(result.endReason, "hung_up_after_answer");
  const asked = (socket.sent as { event_id?: string }[]).filter((e) => e.event_id?.startsWith("goodbye_"));
  assert.equal(asked.length, 1);
});

test("after 'Alô?' the AI introduces itself on its own; silence after the answer still ends the call", async () => {
  const { socket, call } = setup(60_000, { silentLineMs: 45, stallMs: 10 });
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Para falar com um atendente, tecle 3." });
  socket.emitEvent(fnCall("k1", "press_phone_keys", { keys: "3" }));
  await new Promise((r) => setTimeout(r, 55));
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "o1", delta: "Oi, boa tarde! Vocês têm Losartana 50 mg?" });
  await new Promise((r) => setTimeout(r, 15));
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i2", delta: "Temos sim, o genérico sai treze e noventa." });
  const result = await call.result;
  assert.equal(result.endReason, "assistant_silent");
});

test("a person who asked to wait and never came back: 'Alô? Ainda está aí?', then the call ends", async () => {
  const { socket, call } = setup(60_000, { waitLimitMs: 30, deadLineMs: 30 });
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "i1", delta: "Farmácia Teste, boa tarde. Só um minutinho, por favor" });
  const result = await call.result;
  assert.equal(result.endReason, "silent_line");
  const check = (socket.sent as { event_id?: string }[]).filter((e) => e.event_id?.startsWith("wait_check_"));
  assert.equal(check.length, 1);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { ReminderCall, type SidebandSocket } from "./reminder-call.js";
import { toE164 } from "./phone.js";
import { buildDelegateInstructions, buildLiveInstructions, goodbyeLine, greetingLine, withoutSaidOpener } from "./prompt.js";

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

function setup() {
  const socket = new FakeSocket();
  let hangups = 0;
  const call = new ReminderCall({
    sessionId: "live_test",
    context: { patientName: "Maria", medications: [{ name: "Losartana", dose: "50 mg" }] },
    socket,
    hangup: async () => {
      hangups++;
      socket.emitEvent({ type: "session.closed", event_id: "closed", reason: "close_requested", usage: { seconds: 31 } });
    },
    maxCallMs: 60_000,
    goodbyeMs: 5,
    closeGraceMs: 5,
  });
  return { socket, call, hangups: () => hangups };
}

function toolCall(taken: boolean, note = "", feels_unwell = false) {
  return {
    type: "response.event",
    event_id: `ev_tool_${taken}`,
    delegation_id: "item_1",
    event: {
      type: "response.output_item.done",
      item: { type: "function_call", name: "record_dose_answer", call_id: "call_1", arguments: JSON.stringify({ taken, feels_unwell, note }) },
    },
  };
}

test("confirmed dose: greets on answer, records tool call, hangs up", async () => {
  const { socket, call, hangups } = setup();
  socket.emitEvent({ type: "transport.ringing", event_id: "e1" });
  socket.emitEvent({ type: "transport.answered", event_id: "e2" });
  assert.equal(socket.sent[1].type, "session.commentary.append");
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "e3", delta: "Bom dia, Maria. " });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "e4", delta: "Já tomou o remédio?" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "e5", delta: "Tomei sim." });
  socket.emitEvent(toolCall(true));
  // Replayed event must be ignored.
  socket.emitEvent(toolCall(true));

  const result = await call.result;
  assert.equal(result.outcome, "confirmed");
  assert.equal(result.confirmed, true);
  assert.equal(result.durationSeconds, 31);
  assert.equal(result.endReason, "hung_up_after_answer");
  assert.deepEqual(result.transcript, [
    { speaker: "assistant", text: "Bom dia, Maria. Já tomou o remédio?" },
    { speaker: "patient", text: "Tomei sim." },
  ]);
  const types = socket.sent.map((e) => e.type);
  assert.deepEqual(types.slice(0, 2), ["session.input_audio.mute", "session.commentary.append"]);
  assert.ok(types.includes("response.item.create") && types.includes("response.create"));
  assert.equal(hangups(), 1);
  assert.equal(socket.closed, true);
});

test("patient says she did not take it", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a" });
  socket.emitEvent(toolCall(false, "acabou o remédio"));
  const result = await call.result;
  assert.equal(result.outcome, "not_taken");
  assert.equal(result.confirmed, false);
  assert.equal(result.note, "acabou o remédio");
});

test("call fails before answer", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.failed", event_id: "f", error: { code: "busy", message: "486" } });
  const result = await call.result;
  assert.equal(result.outcome, "failed");
  assert.equal(result.confirmed, false);
  assert.match(result.error ?? "", /busy/);
});

test("answered but socket closes without an answer is unclear", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a" });
  socket.emit("close");
  const result = await call.result;
  assert.equal(result.outcome, "unclear");
  assert.equal(result.confirmed, false);
});

test("toE164 normalizes Brazilian numbers", () => {
  assert.equal(toE164("(11) 91234-5678"), "+5511912345678");
  assert.equal(toE164("+55 11 91234-5678"), "+5511912345678");
  assert.equal(toE164("5511912345678"), "+5511912345678");
  assert.equal(toE164("1132345678"), "+551132345678");
  assert.throws(() => toE164("12345"));
});

test("greeting follows the time in São Paulo", async () => {
  const { greetingFor } = await import("./prompt.js");
  assert.equal(greetingFor(new Date("2026-11-11T12:00:00Z")), "bom dia");
  assert.equal(greetingFor(new Date("2026-11-11T18:00:00Z")), "boa tarde");
  assert.equal(greetingFor(new Date("2026-11-11T02:30:00Z")), "boa noite");
});

test("call closed by the far side keeps the Live close reason", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  socket.emitEvent({ type: "session.closed", event_id: "c1", reason: "remote_hangup" });
  const result = await call.result;
  assert.equal(result.outcome, "unclear");
  assert.equal(result.endReason, "session_closed: remote_hangup");
});

test("greeting is one short line", async () => {
  const { buildGreeting } = await import("./prompt.js");
  const g = buildGreeting(
    { patientName: "Dona Maria", medications: [{ name: "Losartana", dose: "50 mg" }] },
    new Date("2026-11-11T02:30:00Z"),
  );
  assert.match(g, /"Oi, Dona Maria, boa noite! Aqui é a assistente virtual da Recuidado\. Como a senhora está\?"/);
  assert.doesNotMatch(g, /Losartana/);
});

test("three or more medicines are not read one by one", async () => {
  const { medicationNames } = await import("./prompt.js");
  const morning = new Date("2026-11-11T12:00:00Z");
  assert.equal(medicationNames([{ name: "Losartana" }], morning), "a Losartana");
  assert.equal(medicationNames([{ name: "Losartana" }, { name: "AAS" }], morning), "a Losartana e o AAS");
  assert.equal(medicationNames([{ name: "A" }, { name: "B" }, { name: "C" }], morning), "os remédios da manhã");
});

test("mutes her microphone during the greeting and unmutes after the question", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "m1" });
  assert.deepEqual(socket.sent.slice(0, 2).map((e) => e.type), ["session.input_audio.mute", "session.commentary.append"]);
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "m2", delta: "Oi, Maria! Como a senhora está?" });
  await new Promise((r) => setTimeout(r, 900));
  assert.equal(socket.sent.filter((e) => e.type === "session.input_audio.unmute").length, 1);
  socket.emit("close");
  await call.result;
});

test("hangs up after the goodbye is spoken, not before", async () => {
  const socket = new FakeSocket();
  let hangups = 0;
  const call = new ReminderCall({
    sessionId: "live_bye",
    context: { patientName: "Maria", medications: [{ name: "Losartana" }] },
    socket,
    hangup: async () => {
      hangups++;
      socket.emitEvent({ type: "session.closed", event_id: "closed", reason: "close_requested" });
    },
    maxCallMs: 60_000,
    goodbyeMs: 150,
    goodbyeTailMs: 30,
    closeGraceMs: 5,
  });
  socket.emitEvent({ type: "transport.answered", event_id: "b1" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "b0", delta: "Oi, Maria! Como a senhora está?" });
  socket.emitEvent(toolCall(true));
  await new Promise((r) => setTimeout(r, 100));
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "b1b", delta: "Vou avisar a família. " });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(hangups, 0, "still talking, no hangup yet");
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "b2", delta: "Obrigada, tchau, Maria!" });
  const result = await call.result;
  assert.equal(hangups, 1);
  assert.equal(result.endReason, "hung_up_after_goodbye");
});

test("hangs up soon after she answers the goodbye", async () => {
  const socket = new FakeSocket();
  let hangups = 0;
  const call = new ReminderCall({
    sessionId: "live_reply",
    context: { patientName: "Maria", medications: [{ name: "Losartana" }] },
    socket,
    hangup: async () => {
      hangups++;
      socket.emitEvent({ type: "session.closed", event_id: "closed", reason: "close_requested" });
    },
    maxCallMs: 60_000,
    goodbyeTailMs: 5_000,
    replyTailMs: 20,
    closeGraceMs: 5,
  });
  socket.emitEvent({ type: "transport.answered", event_id: "r1" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "r0", delta: "Oi, Maria! Como a senhora está?" });
  // The goodbye is said while the answer is still being recorded.
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "r2", delta: "Obrigada, tchau, Maria!" });
  socket.emitEvent(toolCall(true));
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "r3", delta: "Tchau!" });
  const result = await call.result;
  assert.equal(hangups, 1);
  assert.equal(result.endReason, "hung_up_after_goodbye");
});

test("asks for the goodbye once and hangs up when it does not come", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "n1" });
  socket.emitEvent(toolCall(true));
  const result = await call.result;
  assert.equal(result.endReason, "hung_up_after_answer");
  assert.equal(socket.sent.filter((e) => String(e.event_id).startsWith("goodbye_")).length, 1);
});

test("plays a recorded greeting when one exists", async () => {
  const socket = new FakeSocket();
  const call = new ReminderCall({
    sessionId: "live_fixture",
    context: { patientName: "Maria", medications: [{ name: "Losartana" }] },
    socket,
    hangup: async () => socket.emitEvent({ type: "session.closed", event_id: "closed", reason: "close_requested" }),
    maxCallMs: 60_000,
    greetingAudio: Buffer.alloc(48_000),
    closeGraceMs: 5,
  });
  socket.emitEvent({ type: "transport.answered", event_id: "f1" });
  assert.equal(socket.sent[0].type, "session.output_audio.fixture.play");
  assert.ok(!socket.sent.some((e) => e.type === "session.commentary.append"));
  socket.emitEvent({ type: "session.output_audio.fixture.played", event_id: "f2" });
  assert.equal(socket.sent.at(-1)?.type, "session.instructions.append");
  socket.emit("close");
  await call.result;
});

test("records the greeting audio when the model says the expected line", async () => {
  const socket = new FakeSocket();
  let recorded: Buffer | undefined;
  const now = new Date("2026-11-11T12:00:00Z");
  const call = new ReminderCall({
    sessionId: "live_capture",
    context: { patientName: "Dona Maria", medications: [{ name: "Losartana" }] },
    socket,
    hangup: async () => socket.emitEvent({ type: "session.closed", event_id: "closed", reason: "close_requested" }),
    maxCallMs: 60_000,
    now,
    onGreetingRecorded: (_line, audio) => (recorded = audio),
    closeGraceMs: 5,
  });
  const chunk = Buffer.alloc(9600, 1).toString("base64");
  socket.emitEvent({ type: "transport.answered", event_id: "c1" });
  socket.emitEvent({ type: "session.output_audio.delta", delta: chunk, start_ms: 1000, end_ms: 1200 });
  socket.emitEvent({ type: "session.output_audio.delta", delta: chunk, start_ms: 1200, end_ms: 1400 });
  socket.emitEvent({
    type: "session.output_transcript.delta",
    event_id: "c2",
    delta: "Oi, Dona Maria, bom dia! Aqui é a assistente virtual da Recuidado. Como a senhora está?",
    start_ms: 1000,
    end_ms: 1400,
  });
  // Audio after the greeting is not part of it.
  socket.emitEvent({ type: "session.output_audio.delta", delta: chunk, start_ms: 3000, end_ms: 3200 });
  assert.equal(recorded?.length, 2 * 9600);
  socket.emit("close");
  await call.result;
});

test("records that she is not feeling well", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "w1" });
  socket.emitEvent(toolCall(true, "Estou com tontura", true));
  const result = await call.result;
  assert.equal(result.outcome, "confirmed");
  assert.equal(result.feelsUnwell, true);
  assert.equal(result.note, "Estou com tontura");
});

test("voicemail greeting ends the call as no answer", async () => {
  const { socket, call, hangups } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "v1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "v2", delta: "A pessoa não está disponível. Grave a sua " });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "v3", delta: "mensagem após o sinal." });
  const result = await call.result;
  assert.equal(result.outcome, "no_answer");
  assert.equal(result.endReason, "voicemail");
  assert.equal(hangups(), 1);
});

test("an emergency is reported and counts as unwell", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "e1" });
  socket.emitEvent({
    type: "response.event",
    event_id: "e_tool",
    event: {
      type: "response.output_item.done",
      item: {
        type: "function_call",
        name: "record_dose_answer",
        call_id: "call_e",
        arguments: JSON.stringify({ taken: true, feels_unwell: false, emergency: true, note: "Caí no banheiro" }),
      },
    },
  });
  const result = await call.result;
  assert.equal(result.emergency, true);
  assert.equal(result.feelsUnwell, true);
});

test("alert call speaks the message and hangs up after it", async () => {
  const { AlertCall, buildEmergencyMessage } = await import("./alert-call.js");
  const socket = new FakeSocket();
  let hangups = 0;
  const message = buildEmergencyMessage("Dona Maria", "Caí no banheiro");
  assert.match(message, /Liguei para Dona Maria para saber sobre o medicamento, e ela disse: "Caí no banheiro"/);
  assert.doesNotMatch(message, /tchau/i);
  const call = new AlertCall({
    sessionId: "live_alert",
    message,
    socket,
    hangup: async () => {
      hangups++;
      socket.emitEvent({ type: "session.closed", event_id: "closed", reason: "close_requested" });
    },
    maxCallMs: 60_000,
    tailMs: 10,
    closeGraceMs: 5,
  });
  socket.emitEvent({ type: "transport.answered", event_id: "a1" });
  assert.equal(socket.sent[0].type, "session.commentary.append");
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "a2", delta: message });
  const result = await call.result;
  assert.equal(hangups, 1);
  assert.equal(result.delivered, true);
  assert.equal(result.endReason, "message_delivered");
});

test("calm alert call is delivered when the assistant says Obrigado", async () => {
  const { AlertCall } = await import("./alert-call.js");
  const socket = new FakeSocket();
  const message = "Olá, Carlos, tudo bem? Aqui é da Recuidado. Tentei falar com Dona Maria e não consegui contato. Por favor, tente entrar em contato com ela. Obrigado.";
  const call = new AlertCall({
    sessionId: "live_calm",
    message,
    socket,
    hangup: async () => socket.emitEvent({ type: "session.closed", event_id: "closed", reason: "close_requested" }),
    maxCallMs: 60_000,
    tailMs: 10,
    closeGraceMs: 5,
  });
  socket.emitEvent({ type: "transport.answered", event_id: "c1" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "c2", delta: "Alô?" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "c3", delta: message });
  const result = await call.result;
  assert.equal(result.delivered, true);
  assert.equal(result.endReason, "message_delivered");
});

test("alert call answered by voicemail is not delivered, so the next caregiver is called", async () => {
  const { AlertCall } = await import("./alert-call.js");
  const socket = new FakeSocket();
  let hangups = 0;
  const message = "Olá, aqui é a assistente virtual da Recuidado. Se for grave, ligue para o SAMU, 192.";
  const call = new AlertCall({
    sessionId: "live_vm",
    message,
    socket,
    hangup: async () => {
      hangups++;
      socket.emitEvent({ type: "session.closed", event_id: "closed", reason: "close_requested" });
    },
    maxCallMs: 60_000,
    tailMs: 10,
    closeGraceMs: 5,
  });
  socket.emitEvent({ type: "transport.answered", event_id: "v1" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "v2", delta: message });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "v3", delta: "Sua chamada está sendo encaminhada para a caixa postal" });
  const result = await call.result;
  assert.equal(hangups, 1);
  assert.equal(result.recording, true);
  assert.equal(result.delivered, false);
  assert.equal(result.endReason, "voicemail");
});

test("emergency: tells her the family will be told and promises the call back; the call back only asks how she is", () => {
  const ctx = { patientName: "Dona Maria", medications: [{ name: "Losartana" }] };
  const live = buildLiveInstructions(ctx);
  assert.match(live, /Entendi\. Vou avisar a sua família e já te ligo de volta para saber como a senhora está, tá bom\? Até já\./);
  assert.match(live, /Tiredness alone is not an emergency/);
  const back = { ...ctx, checkIn: true };
  assert.match(greetingLine(back), /de novo\. A senhora está melhor\?/);
  assert.equal(goodbyeLine(back), "Tchau!");
  assert.doesNotMatch(buildLiveInstructions(back), /já tomou/);
  assert.match(buildDelegateInstructions(back), /taken=false/);
});

test("emergency recorded without the family line: asks for it, and only the goodbye after it ends the call", async () => {
  const { socket, call } = setup();
  socket.emitEvent({ type: "transport.answered", event_id: "e1" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "e2", delta: "Oi, Maria! Como a senhora está?" });
  socket.emitEvent({ type: "session.input_transcript.delta", event_id: "e3", delta: "Caí no banheiro." });
  socket.emitEvent({
    type: "response.event",
    event_id: "e_tool",
    event: {
      type: "response.output_item.done",
      item: {
        type: "function_call",
        name: "record_dose_answer",
        call_id: "call_e",
        arguments: JSON.stringify({ taken: false, feels_unwell: true, emergency: true, note: "Caí no banheiro" }),
      },
    },
  });
  const ask = socket.sent.find((m) => m.event_id === "emergency_call_e");
  assert.match(String(ask?.content), /Vou avisar a sua família/);
  // The model's own short goodbye does not end the call before the SAMU line.
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "e4", delta: "Já volto. Obrigada, tchau, Maria!" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "e5", delta: " Entendi. Vou avisar a sua família e já te ligo de volta para saber como a senhora está, tá bom?" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "e6", delta: " Até já." });
  const result = await call.result;
  assert.equal(result.emergency, true);
  assert.equal(result.endReason, "hung_up_after_goodbye");
  assert.match(result.transcript.map((l) => l.text).join(" "), /avisar a sua família/);
});

test("dose time and gender: the question names the time, and a man is \"o senhor\"", async () => {
  const { medicationQuestion, spokenTime, notTakenLine, recallNotTakenLine } = await import("./prompt.js");
  // 17:00 UTC = 14:00 in São Paulo.
  assert.equal(spokenTime(new Date("2026-11-11T17:00:00Z")), "das duas da tarde");
  assert.equal(spokenTime(new Date("2026-11-11T16:30:00Z")), "da uma e meia da tarde");
  assert.equal(spokenTime(new Date("2026-11-11T15:00:00Z")), "do meio-dia");
  assert.equal(spokenTime(new Date("2026-11-11T11:15:00Z")), "das oito e 15 da manhã");
  assert.equal(spokenTime(new Date("2026-11-11T23:00:00Z")), "das oito da noite");
  const ctx = { patientName: "Dona Maria", medications: [{ name: "Losartana" }], doseTime: "2026-11-11T17:00:00Z" };
  assert.equal(medicationQuestion(ctx), "A senhora já tomou a Losartana das duas da tarde?");
  const three = { ...ctx, medications: [{ name: "A" }, { name: "B" }, { name: "C" }] };
  assert.equal(medicationQuestion(three), "A senhora já tomou os remédios das duas da tarde?");
  const man = { patientName: "Seu João", gender: "male" as const, medications: [{ name: "Losartana" }] };
  assert.match(greetingLine(man), /Como o senhor está\?$/);
  assert.match(buildLiveInstructions(man), /address him as "o senhor"/);
  assert.equal(notTakenLine({ ...ctx, recallLater: true }), "Tá bom, Dona Maria, daqui a pouco eu ligo para confirmar. Obrigada, tchau!");
  assert.equal(notTakenLine({ ...ctx, recallLater: false }), recallNotTakenLine(ctx));
  const recall = { ...ctx, recall: true };
  assert.equal(greetingLine(recall), "Oi, Dona Maria! É a assistente virtual da Recuidado de novo. A senhora já tomou a Losartana das duas da tarde?");
});

test("not taken yet: the closing line promises the second call", async () => {
  const socket = new FakeSocket();
  const call = new ReminderCall({
    sessionId: "live_recall",
    context: { patientName: "Maria", medications: [{ name: "Losartana" }], recallLater: true },
    socket,
    hangup: async () => socket.emitEvent({ type: "session.closed", event_id: "closed", reason: "close_requested" }),
    maxCallMs: 60_000,
    goodbyeMs: 5,
    closeGraceMs: 5,
  });
  socket.emitEvent({ type: "transport.answered", event_id: "n1" });
  socket.emitEvent({ type: "session.output_transcript.delta", event_id: "n2", delta: "Oi, Maria! Como a senhora está?" });
  socket.emitEvent(toolCall(false, "Vou tomar depois"));
  const ask = socket.sent.find((m) => m.event_id === "goodbye_call_1");
  assert.match(String(ask?.content), /daqui a pouco eu ligo para confirmar/);
  const result = await call.result;
  assert.equal(result.outcome, "not_taken");
});

test("the required line skips an opener the assistant already said", () => {
  assert.equal(
    withoutSaidOpener("Que bom. Vou avisar a sua família. Tchau, Dona Maria!", "Que bom."),
    "Vou avisar a sua família. Tchau, Dona Maria!",
  );
  assert.equal(
    withoutSaidOpener("Tá bom, Dona Maria, vou avisar a sua família de novo. Até já!", "Tá bom. Já vou chamar sua família."),
    "Dona Maria, vou avisar a sua família de novo. Até já!",
  );
  assert.equal(withoutSaidOpener("Que bom. Vou avisar a sua família.", ""), "Que bom. Vou avisar a sua família.");
  assert.equal(withoutSaidOpener("Entendi. Vou avisar a sua família. Até já.", "Entendi."), "Vou avisar a sua família. Até já.");
});

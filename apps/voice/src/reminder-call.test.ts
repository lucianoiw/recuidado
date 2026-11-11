import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { ReminderCall, type SidebandSocket } from "./reminder-call.js";
import { toE164 } from "./phone.js";

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
  assert.equal(socket.sent[0].type, "session.commentary.append");
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
  assert.deepEqual(types, ["session.commentary.append", "response.item.create", "response.create"]);
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
  assert.match(g, /"Boa noite, Dona Maria, aqui é do Recuidado\. Já tomou a Losartana\?"/);
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

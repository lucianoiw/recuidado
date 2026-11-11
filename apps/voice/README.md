# @recuidado/voice

Dose reminder phone calls. When a dose is not confirmed in the app, the API asks this
service to call the patient. GPT-Live (`gpt-live-1`) talks to her in Portuguese, records
whether she took the medicine and the service posts the result back to the API, which
alerts the family when `confirmed` is false.

```
api ──POST /calls──▶ voice ──POST /v1/live/sessions (SIP)──▶ OpenAI GPT-Live
                       ▲                                        │ SIP over TLS, SRTP, Opus
                       │ sideband WebSocket (events, tool call) ▼
                       │                                    Asterisk (deploy/asterisk)
api ◀─POST /doses/:id/voice-result─┘                            │ SIP, G.711
                                                              Nvoip ──▶ patient's phone
```

Why Asterisk: outbound SIP from OpenAI exists only in the Live API and requires TLS,
SDES-SRTP and Opus on the trunk. Nvoip offers TLS but only G.711, so Asterisk on the VPS
terminates the OpenAI leg and dials Nvoip, transcoding Opus to G.711.

## API

- `GET /health` → `{ ok, configured }`
- `POST /calls` (header `Authorization: Bearer $VOICE_API_TOKEN`)
  `{ "doseId": "…", "phone": "11912345678", "patientName": "Maria", "medications": ["Losartana 50 mg"] }`
  → `202 { "callId": "live_…" }`. Numbers outside `CALL_ALLOWED_NUMBERS` get 403.
- `GET /calls/:callId` → status and result.

Result posted to `{API_URL}/doses/:doseId/voice-result`:

```json
{
  "sessionId": "live_…",
  "outcome": "confirmed | not_taken | unclear | no_answer | failed",
  "confirmed": true,
  "note": "optional detail from the patient",
  "feelsUnwell": false,
  "transcript": [{ "speaker": "assistant", "text": "…" }, { "speaker": "patient", "text": "…" }],
  "durationSeconds": 42,
  "endReason": "hung_up_after_answer"
}
```

`feelsUnwell` is what she answered to "Como a senhora está?" (self-report, no diagnosis).
`endReason` says why the call ended: `hung_up_after_goodbye`, `hung_up_before_answer_recorded`, `hung_up_after_answer` (answer
recorded, then 8 s of silence without a goodbye), `voicemail`, `max_duration`,
`session_closed: <reason>`, `sideband_closed` or `error`.

The API stores every result in `voice_calls` (`GET /doses/:id/voice-calls`) and, when
`feelsUnwell` is true, pushes the caregivers right away even if the dose was taken.

## Call script

1. "Oi, Dona Maria, bom dia! É a assistente virtual da Recuidado. Como a senhora está?"
   (bom dia / boa tarde / boa noite by São Paulo time). The first call says it through the model
   (about 3.5 s after answer, her microphone muted meanwhile) and records that audio from the
   sideband when the words match. Later calls with the same line and voice play the recording as
   a fixture the moment she answers. Recordings live in memory and `GREETING_CACHE_DIR`.
2. A short reaction, then "A senhora já tomou a Losartana?". With three or more medicines it asks
   about "os remédios da manhã" instead of reading the list.
3. "Obrigada, tchau, Dona Maria!", said while the answer is delegated (no waiting for the delegated
   model). Once the answer is recorded it waits up to 3 s for her to say goodbye back and hangs up
   1 s after she stops talking. Without a goodbye it asks for it once and hangs up after 8 s of
   silence. If the answer is not recorded 12 s after the goodbye, it hangs up anyway.

If she asks who is calling: "É a Recuidado, assistente virtual do lembrete do remédio." A carrier voicemail greeting ("grave a sua mensagem", "após o sinal", "caixa postal") ends the
call as `no_answer`.

## Debugging a call

- Voice service log: one line per Live event with timestamp, plus the full `session.closed` event.
- Asterisk log: `Call ended: dialstatus=… cause=… source=… answered=…s` on every hangup.
- Container logs are lost on redeploy; `voice_calls` keeps the result.

## Run

```
pnpm --filter @recuidado/voice build
pnpm --filter @recuidado/voice test
# One real call, printing the result (needs the env vars in .env.example):
node apps/voice/dist/cli.js 11912345678 Maria "Losartana 50 mg"
```

## Deploy (Coolify)

1. Give the `recuidado/voice` resource the domain `voz.recuidado.com.br` so Traefik issues its
   certificate. The `recuidado/asterisk` resource (`deploy/asterisk/docker-compose.yml`) reads it
   from `/data/coolify/proxy/acme.json`.
2. Set the variables listed in the root `.env.example` (voice section).
3. Open `5061/tcp` and `10000-10200/udp` on the VPS firewall.
4. Nvoip needs balance and a caller ID (virtual number) on the SIP user before any call completes.

## Pharmacy call ("Perguntar à farmácia")

`POST /pharmacy-calls` (same token)
`{ "inquiryId": "…", "phone": "11912345678", "medications": [{ "name": "Losartana", "dose": "50 mg" }] }`
→ `202 { "callId": "live_…" }`. At most 3 medicines. The number must be listed one by one in
`CALL_ALLOWED_NUMBERS`: `*` does not cover pharmacies, because a pharmacy is a third party. The API
only ever sends `PHARMACY_CALL_PHONE`, a phone the team controls.

Script (`pharmacy-prompt.ts`): the assistant waits for the other side to speak. If nobody speaks in 4 s
it opens. First line: "Oi, bom dia! Aqui é a assistente virtual da Recuidado, ligando em nome de uma
família. Vocês têm Losartana 50 mg?". For each medicine it asks stock, price of one box and Farmácia
Popular, then records with `record_pharmacy_answer` and says "Muito obrigada, tchau!". It never buys,
reserves or gives personal data.

Recorded menus (URA): the delegated model calls `press_phone_keys` and the service sends one
`transport.dtmf.send` per key over the sideband (300 ms apart). Only 0-9, `*` and `#`, up to 8 keys.
Asterisk passes the tones to Nvoip as RFC 4733 (`dtmf_mode=rfc4733` on both legs).

Result posted to `{API_URL}/pharmacy-inquiries/:inquiryId/voice-result`:
`{ sessionId, outcome: "answered | unclear | no_answer | failed", items: [{ medication, available, priceCents, package, farmaciaPopular }], note, keysPressed, transcript, durationSeconds, endReason }`.

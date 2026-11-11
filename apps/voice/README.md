# @recuidado/voice

Dose reminder phone calls. When a dose is not confirmed in the app, the API asks this
service to call the patient. GPT-Live (`gpt-live-1`) talks to her in Portuguese, records
whether she took the medicine and the service posts the result back to the API, which
alerts the family when `confirmed` is false.

```
api ──POST /calls──▶ voice ──POST /v1/live/sessions (SIP)──▶ OpenAI GPT-Live
                       ▲                                        │ SIP over TLS, SRTP, Opus
                       │ sideband WebSocket (events, tool call) ▼
                       │                                    Asterisk (infra/asterisk)
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
  "transcript": [{ "speaker": "assistant", "text": "…" }, { "speaker": "patient", "text": "…" }],
  "durationSeconds": 42
}
```

## Run

```
pnpm --filter @recuidado/voice build
pnpm --filter @recuidado/voice test
# One real call, printing the result (needs the env vars in .env.example):
node apps/voice/dist/cli.js 11912345678 Maria "Losartana 50 mg"
```

## Deploy (Coolify)

1. Give the `voice` service the domain `voz.recuidado.com.br` so Traefik issues its
   certificate. The `asterisk` service reads it from `/data/coolify/proxy/acme.json`.
2. Set the variables listed in the root `.env.example` (voice section).
3. Open `5061/tcp` and `10000-10200/udp` on the VPS firewall.
4. Nvoip needs balance and a caller ID (virtual number) on the SIP user before any call completes.

# @recuidado/mcp

MCP server over the Recuidado API. Any MCP client (Claude, ChatGPT, Cursor, an agent) can read the care plan, follow today's doses, confirm a dose, read the family alerts and check where a medicine is free.

Endpoint: `https://mcp.recuidado.com.br` (Streamable HTTP, stateless). `/mcp` also works (the first published URL). Serves 2026-07-28 clients and falls back to 2025-era clients.

| Tool | What it does | API call |
| --- | --- | --- |
| `get_care_plan` | Medications, times, where each is free (Farmácia Popular, UBS), Alto Custo flag, monthly cost, pills left, caregivers | `GET /family` |
| `get_today_doses` | Today's doses (Brasília time): taken, pending or missed, how it was confirmed, family alerted, "não estou bem" reports | `GET /family` |
| `confirm_dose` | Marks a dose of today as taken, like the "Tomei" button. Only doses of today in that family | `GET /family`, `POST /doses/:id/confirm` |
| `list_family_alerts` | Alerts sent to the family: missed dose, not feeling well, running out | `GET /family/alerts` |
| `find_free_medicine` | Searches the CMED list and says, per strength, where it is free and if it is in Alto Custo | `GET /medications/search` |

Tools take no family id: each connection is linked to one family at login. Phones never leave the server. The server gives no clinical advice: its instructions tell the model to send health questions to the doctor and emergencies to SAMU 192.

## Login (OAuth)

`/mcp` needs a bearer token. MCP clients find the login on their own (401 with `WWW-Authenticate`, then `/.well-known/oauth-protected-resource/mcp` and `/.well-known/oauth-authorization-server`), register with dynamic client registration (`POST /register`) and open `/authorize`.

The page "Conexão da família" has one button, Autorizar, which links the demo family. No password: it is a proof of concept with synthetic data. Someone who signed up their own family can paste the invite link instead (any link with the family id), which gives the same access the link already gives in the web app.

Code with PKCE S256, access token for 30 days, refresh token for a year. Everything is HMAC-signed with `MCP_AUTH_SECRET`, so nothing is stored and redeploys keep the links. Known limits: a code can be replayed during its 5 minutes, and a token cannot be revoked one by one (changing the secret revokes all).

## Decisions and findings

- Separate service over the public API, not a module inside `apps/api`: no conflict with the API work, and the MCP sees exactly what the web app sees.
- MCP TypeScript SDK v2 (`@modelcontextprotocol/server` 2.4, spec 2026-07-28) with `createMcpHandler`: stateless, one server per request, and the 2025-era fallback still serves older clients (tested with the v1 SDK client).
- All MCP traffic reaches the API from one IP, so it shares the API limit of `RATE_LIMIT_PER_MINUTE` (300). Enough for the demo.
- MCP at the root URL, like the Send to Myself server where Claude shows the app icon; `/mcp` stays as an alias.
- Icons: `serverInfo.icons` plus `/favicon.ico`, `/favicon.svg` and `/icon-512.png`, the same art as the web app.
- Siri (searched on 11/11/2026): no reliable source shows Siri in iOS 27 accepting a remote MCP server; third-party access to Siri goes through App Intents in an installed app. Closest options: an Apple Shortcut calling the API, or the Claude or ChatGPT app by voice with this connector.

## Run

```
pnpm --filter @recuidado/mcp build
API_URL=http://localhost:4000 pnpm --filter @recuidado/mcp start
```

Variables: `API_URL`, `MCP_PUBLIC_URL` and `MCP_AUTH_SECRET` (required in production; without the secret a random one is used and links end on restart), `PORT` (default 7000), `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` (optional, event `mcp_tool_called`).

## Connect

- Claude (claude.ai or desktop): Settings, Connectors, Add custom connector, URL `https://mcp.recuidado.com.br`, then Autorizar.
- Claude Code: `claude mcp add --transport http recuidado https://mcp.recuidado.com.br`
- Inspector: `npx @modelcontextprotocol/inspector` and open the same URL.

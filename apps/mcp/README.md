# @recuidado/mcp

MCP server over the Recuidado API. Any MCP client (Claude, ChatGPT, Cursor, an agent) can read the care plan, follow today's doses, confirm a dose, read the family alerts and check where a medicine is free.

Endpoint: `https://mcp.recuidado.com.br/mcp` (Streamable HTTP, stateless). Serves 2026-07-28 clients and falls back to 2025-era clients.

| Tool | What it does | API call |
| --- | --- | --- |
| `get_care_plan` | Medications, times, where each is free (Farmácia Popular, UBS), Alto Custo flag, monthly cost, pills left, caregivers | `GET /family` |
| `get_today_doses` | Today's doses (Brasília time): taken, pending or missed, how it was confirmed, family alerted, "não estou bem" reports | `GET /family` |
| `confirm_dose` | Marks a dose of today as taken, like the "Tomei" button. Only doses of today in that family | `GET /family`, `POST /doses/:id/confirm` |
| `list_family_alerts` | Alerts sent to the family: missed dose, not feeling well, running out | `GET /family/alerts` |
| `find_free_medicine` | Searches the CMED list and says, per strength, where it is free and if it is in Alto Custo | `GET /medications/search` |

Every tool takes an optional `familyId`. Without it, the demo family (synthetic data) is used. Phones never leave the server. The server gives no clinical advice: its instructions tell the model to send health questions to the doctor and emergencies to SAMU 192.

No login yet, same as the web app: the `familyId` in the invite link is the key.

## Run

```
pnpm --filter @recuidado/mcp build
API_URL=http://localhost:4000 pnpm --filter @recuidado/mcp start
```

Variables: `API_URL` (required in production), `PORT` (default 7000), `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` (optional, event `mcp_tool_called`).

## Connect

- Claude (claude.ai or desktop): Settings, Connectors, Add custom connector, URL `https://mcp.recuidado.com.br/mcp`.
- Claude Code: `claude mcp add --transport http recuidado https://mcp.recuidado.com.br/mcp`
- Inspector: `npx @modelcontextprotocol/inspector` and open the same URL.

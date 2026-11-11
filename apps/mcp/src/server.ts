import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { telemetryFromEnv } from "@recuidado/telemetry";
import { RecuidadoApi } from "./api.ts";
import { createRecuidadoServer } from "./tools.ts";

// Events, exceptions and logs go to PostHog; logs also stay on stdout.
const telemetry = telemetryFromEnv("mcp");

const apiUrl = process.env.API_URL ?? "http://localhost:4000";
const port = Number(process.env.PORT ?? 7000);
const api = new RecuidadoApi(apiUrl);

// Stateless: every HTTP request gets a fresh server. Serves 2026 clients and falls back for 2025-era ones.
const mcp = toNodeHandler(
  createMcpHandler(() =>
    createRecuidadoServer(api, (tool, ok, error) => {
      telemetry.capture("mcp_tool_called", { tool, ok });
      if (error) telemetry.captureException(error, { tool });
    }),
  ),
);

const HOME = `Recuidado MCP

Servidor MCP do Recuidado: plano de remédios, doses do dia, avisos à família e onde o remédio é grátis no SUS.
Endpoint (Streamable HTTP): /mcp
Sem familyId, as ferramentas usam a família de demonstração (dados sintéticos).
`;

function send(res: ServerResponse, status: number, type: string, body: string) {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (path === "/health") return send(res, 200, "application/json", JSON.stringify({ ok: true }));
  if (path === "/mcp") return mcp(req, res);
  if (path === "/" && req.method === "GET") return send(res, 200, "text/plain; charset=utf-8", HOME);
  send(res, 404, "application/json", JSON.stringify({ error: "not found" }));
}

const server = createServer((req, res) => {
  handle(req, res).catch((error: unknown) => {
    telemetry.captureException(error, { path: req.url });
    if (!res.headersSent) send(res, 500, "application/json", JSON.stringify({ error: "internal error" }));
    else res.end();
  });
});

server.listen(port, "0.0.0.0", () => {
  telemetry.info(`MCP server on :${port}/mcp, API at ${apiUrl}`);
  telemetry.capture("service_started", { telemetry: telemetry.enabled });
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close();
    void telemetry.shutdown().finally(() => process.exit(0));
  });
}

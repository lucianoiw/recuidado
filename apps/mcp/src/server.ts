import { createServer } from "node:http";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { telemetryFromEnv } from "@recuidado/telemetry";
import { RecuidadoApi } from "./api.ts";
import { createApp } from "./app.ts";
import { devSecret } from "./auth.ts";

// Events, exceptions and logs go to PostHog; logs also stay on stdout.
const telemetry = telemetryFromEnv("mcp");

const apiUrl = process.env.API_URL ?? "http://localhost:4000";
const port = Number(process.env.PORT ?? 7000);
const publicUrl = process.env.MCP_PUBLIC_URL ?? `http://localhost:${port}`;
let authSecret = process.env.MCP_AUTH_SECRET ?? "";
if (authSecret.length < 32) {
  // Stays up so a deploy without the secret still answers; links break on every restart.
  telemetry.warn("MCP_AUTH_SECRET missing or shorter than 32 characters: using a random one, links end on restart.");
  authSecret = devSecret();
}

const app = createApp({
  api: new RecuidadoApi(apiUrl),
  publicUrl,
  authSecret,
  onToolCall: (tool, ok, error) => {
    telemetry.capture("mcp_tool_called", { tool, ok });
    if (error) telemetry.captureException(error, { tool });
  },
});

const handler = toNodeHandler({ fetch: app });

const server = createServer((req, res) => {
  handler(req, res).catch((error: unknown) => {
    telemetry.captureException(error, { path: req.url });
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" }).end('{"error":"internal error"}');
    else res.end();
  });
});

server.listen(port, "0.0.0.0", () => {
  telemetry.info(`MCP server on :${port}/mcp (${publicUrl}), API at ${apiUrl}`);
  telemetry.capture("service_started", { telemetry: telemetry.enabled });
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close();
    void telemetry.shutdown().finally(() => process.exit(0));
  });
}

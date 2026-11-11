import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  oauthMetadataResponse,
  requireBearerAuth,
} from "@modelcontextprotocol/server";
import type { RecuidadoApi } from "./api.ts";
import { Auth, type LinkedFamily } from "./auth.ts";
import { homePage } from "./pages.ts";
import { createRecuidadoServer, type ToolCallHook } from "./tools.ts";

export interface AppOptions {
  api: RecuidadoApi;
  /** Public origin, e.g. https://mcp.recuidado.com.br. */
  publicUrl: string;
  authSecret: string;
  onToolCall?: ToolCallHook;
  publicDir?: string;
}

const STATIC: Record<string, [file: string, type: string]> = {
  "/favicon.ico": ["icon-192.png", "image/png"],
  "/favicon.svg": ["favicon.svg", "image/svg+xml"],
  "/icon-192.png": ["icon-192.png", "image/png"],
  "/icon-512.png": ["icon-512.png", "image/png"],
  "/apple-touch-icon.png": ["icon-192.png", "image/png"],
};

/** The whole MCP service as one fetch handler: icons, OAuth, discovery documents and the MCP endpoint (/ and /mcp) behind a bearer token. */
export function createApp({ api, publicUrl, authSecret, onToolCall, publicDir }: AppOptions) {
  const auth = new Auth(publicUrl, authSecret, api);
  // Served at the root (like most remote MCP servers) and at /mcp (the first published URL). Same tokens on both.
  const endpoints = [new URL("/", auth.issuer), auth.resource].map((resource) => {
    const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(resource);
    return {
      path: resource.pathname,
      metadata: {
        oauthMetadata: auth.metadata(),
        resourceServerUrl: resource,
        resourceName: "Recuidado",
        scopesSupported: ["family"],
        dangerouslyAllowInsecureIssuerUrl: auth.issuer.protocol === "http:",
      },
      gate: requireBearerAuth({ verifier: auth, resourceMetadataUrl }),
    };
  });
  const mcp = createMcpHandler(({ authInfo }) =>
    createRecuidadoServer(api, (authInfo?.extra?.familyId as LinkedFamily | undefined) ?? null, onToolCall),
  );
  const dir = publicDir ?? join(import.meta.dirname, "..", "public");
  const files = new Map(Object.entries(STATIC).map(([path, [file, type]]) => [path, { body: readFileSync(join(dir, file)), type }]));

  return async function fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/health") return Response.json({ ok: true });
    const file = files.get(pathname);
    if (file && request.method === "GET") {
      return new Response(new Uint8Array(file.body), {
        headers: { "content-type": file.type, "cache-control": "public, max-age=86400" },
      });
    }
    const wantsPage = request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
    if (pathname === "/" && wantsPage) {
      return new Response(homePage(auth.issuer.href.replace(/\/$/, "")), { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    for (const endpoint of endpoints) {
      const discovery = oauthMetadataResponse(request, endpoint.metadata);
      if (discovery) return discovery;
    }
    const authResponse = await auth.handle(request);
    if (authResponse) return authResponse;
    const endpoint = endpoints.find((e) => e.path === pathname);
    if (endpoint) {
      const authInfo = await endpoint.gate(request);
      if (authInfo instanceof Response) return authInfo;
      return mcp.fetch(request, { authInfo });
    }
    return Response.json({ error: "not found" }, { status: 404 });
  };
}

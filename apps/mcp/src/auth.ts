/**
 * A small OAuth 2.1 authorization server, just enough for MCP clients (Claude, ChatGPT) to link one family.
 *
 * Stateless: clients, codes and tokens are HMAC-signed JSON, so nothing is stored and a redeploy keeps every
 * link working while MCP_AUTH_SECRET stays the same. The "login" is weak on purpose (proof of concept): the
 * person pastes the family invite link, or picks the demo family. Whoever has the invite link can already open
 * the family in the web app, so this gives no more access than the app does.
 *
 * Flow: dynamic client registration (RFC 7591), authorization code with PKCE S256, refresh tokens.
 * Known limit: a code can be replayed during its 5 minutes, since nothing is stored.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { type AuthInfo, OAuthError, type OAuthMetadata } from "@modelcontextprotocol/server";
import { ApiError, type RecuidadoApi } from "./api.ts";
import { authorizePage } from "./pages.ts";

const CODE_TTL = 5 * 60;
const ACCESS_TTL = 30 * 24 * 60 * 60;
const REFRESH_TTL = 365 * 24 * 60 * 60;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** The family a token gives access to. `null` is the demo family. */
export type LinkedFamily = string | null;

type Signed =
  | { t: "client"; redirectUris: string[]; name: string }
  | { t: "code"; clientId: string; redirectUri: string; challenge: string; family: LinkedFamily; exp: number }
  | { t: "access"; clientId: string; family: LinkedFamily; exp: number }
  | { t: "refresh"; clientId: string; family: LinkedFamily; exp: number };

const now = () => Math.floor(Date.now() / 1000);
const b64 = (data: Buffer | string) => Buffer.from(data).toString("base64url");

export class Auth {
  readonly issuer: URL;
  readonly resource: URL;

  constructor(
    publicUrl: string,
    private readonly secret: string,
    private readonly api: RecuidadoApi,
  ) {
    this.issuer = new URL(publicUrl);
    this.resource = new URL("/mcp", this.issuer);
  }

  metadata(): OAuthMetadata {
    const at = (path: string) => new URL(path, this.issuer).href;
    return {
      issuer: this.issuer.href,
      authorization_endpoint: at("/authorize"),
      token_endpoint: at("/token"),
      registration_endpoint: at("/register"),
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["family"],
      service_documentation: "https://github.com/lucianoiw/recuidado/tree/main/apps/mcp",
    };
  }

  /** Bearer token check for /mcp. */
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const data = this.open(token);
    if (data?.t !== "access" || data.exp < now()) throw new OAuthError("invalid_token", "Token inválido ou vencido.");
    return {
      token,
      clientId: data.clientId,
      scopes: ["family"],
      expiresAt: data.exp,
      resource: this.resource,
      extra: { familyId: data.family },
    };
  }

  /** Routes /register, /authorize and /token. Undefined for any other path. */
  async handle(request: Request): Promise<Response | undefined> {
    const { pathname } = new URL(request.url);
    if (request.method === "OPTIONS" && ["/register", "/token"].includes(pathname)) return cors(new Response(null, { status: 204 }));
    if (pathname === "/register" && request.method === "POST") return cors(await this.register(request));
    if (pathname === "/token" && request.method === "POST") return cors(await this.token(request));
    if (pathname === "/authorize" && (request.method === "GET" || request.method === "POST")) return this.authorize(request);
    return undefined;
  }

  private async register(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => null)) as { redirect_uris?: unknown; client_name?: unknown } | null;
    const uris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
    if (uris.length === 0 || uris.length > 10 || !uris.every(allowedRedirect)) {
      return json({ error: "invalid_redirect_uri", error_description: "redirect_uris must be https (or localhost)." }, 400);
    }
    const name = typeof body?.client_name === "string" ? body.client_name.slice(0, 80) : "Assistente";
    const clientId = this.seal({ t: "client", redirectUris: uris, name });
    return json(
      {
        client_id: clientId,
        client_id_issued_at: now(),
        client_name: name,
        redirect_uris: uris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
      201,
    );
  }

  private async authorize(request: Request): Promise<Response> {
    const params =
      request.method === "GET" ? new URL(request.url).searchParams : new URLSearchParams(await request.text());
    const clientId = params.get("client_id") ?? "";
    const redirectUri = params.get("redirect_uri") ?? "";
    const client = this.open(clientId);
    // Without a known client and redirect, the error cannot be sent back: show it here.
    if (client?.t !== "client" || !client.redirectUris.includes(redirectUri)) {
      return html(authorizePage({ fatal: "Este link de conexão não é válido. Tente conectar de novo pelo seu assistente." }), 400);
    }
    const back = (query: Record<string, string>) => {
      const url = new URL(redirectUri);
      for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
      const state = params.get("state");
      if (state) url.searchParams.set("state", state);
      return Response.redirect(url.href, 303);
    };
    if (params.get("response_type") !== "code") return back({ error: "unsupported_response_type" });
    const challenge = params.get("code_challenge") ?? "";
    if (params.get("code_challenge_method") !== "S256" || challenge.length < 43) {
      return back({ error: "invalid_request", error_description: "PKCE S256 is required." });
    }
    const hidden = Object.fromEntries(
      ["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope", "resource"]
        .map((k) => [k, params.get(k)])
        .filter((e): e is [string, string] => e[1] !== null),
    );
    if (request.method === "GET") return html(authorizePage({ client: client.name, hidden }));

    if (params.get("action") === "cancel") return back({ error: "access_denied" });
    let family: LinkedFamily = null;
    if (params.get("action") !== "demo") {
      const found = (params.get("invite") ?? "").match(UUID)?.[0]?.toLowerCase();
      if (!found) {
        return html(authorizePage({ client: client.name, hidden, error: "Cole o link do convite que a família recebeu, ou toque em Autorizar para usar a família de demonstração." }), 400);
      }
      try {
        const overview = await this.api.family(found);
        family = overview.isDemo ? null : overview.familyId;
      } catch (error) {
        const message =
          error instanceof ApiError && error.status < 500
            ? "Não achamos essa família. Confira o link do convite."
            : "Não foi possível falar com o Recuidado agora. Tente de novo em instantes.";
        return html(authorizePage({ client: client.name, hidden, error: message }), 400);
      }
    }
    const code = this.seal({ t: "code", clientId, redirectUri, challenge, family, exp: now() + CODE_TTL });
    return back({ code });
  }

  private async token(request: Request): Promise<Response> {
    const params = new URLSearchParams(await request.text());
    const clientId = params.get("client_id") ?? "";
    const fail = (error: string, description: string) => json({ error, error_description: description }, 400);
    if (this.open(clientId)?.t !== "client") return json({ error: "invalid_client", error_description: "Unknown client." }, 401);

    let family: LinkedFamily;
    const grant = params.get("grant_type");
    if (grant === "authorization_code") {
      const code = this.open(params.get("code") ?? "");
      if (code?.t !== "code" || code.exp < now() || code.clientId !== clientId) return fail("invalid_grant", "Invalid or expired code.");
      if (code.redirectUri !== params.get("redirect_uri")) return fail("invalid_grant", "redirect_uri does not match.");
      const verifier = params.get("code_verifier") ?? "";
      if (!safeEqual(b64(createHash("sha256").update(verifier).digest()), code.challenge)) {
        return fail("invalid_grant", "PKCE verification failed.");
      }
      family = code.family;
    } else if (grant === "refresh_token") {
      const refresh = this.open(params.get("refresh_token") ?? "");
      if (refresh?.t !== "refresh" || refresh.exp < now() || refresh.clientId !== clientId) {
        return fail("invalid_grant", "Invalid or expired refresh token.");
      }
      family = refresh.family;
    } else {
      return fail("unsupported_grant_type", "Use authorization_code or refresh_token.");
    }
    return json({
      access_token: this.seal({ t: "access", clientId, family, exp: now() + ACCESS_TTL }),
      token_type: "Bearer",
      expires_in: ACCESS_TTL,
      refresh_token: this.seal({ t: "refresh", clientId, family, exp: now() + REFRESH_TTL }),
      scope: "family",
    });
  }

  private seal(data: Signed): string {
    const body = b64(JSON.stringify(data));
    return `${body}.${this.mac(body)}`;
  }

  private open(value: string): Signed | null {
    const [body, mac] = value.split(".");
    if (!body || !mac || !safeEqual(mac, this.mac(body))) return null;
    try {
      return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Signed;
    } catch {
      return null;
    }
  }

  private mac(body: string): string {
    return createHmac("sha256", this.secret).update(body).digest("base64url");
  }
}

/** A random secret for local runs. Tokens stop working on restart. */
export function devSecret(): string {
  return randomBytes(32).toString("hex");
}

function allowedRedirect(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.hash) return false;
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-frame-options": "DENY",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; form-action 'self' https: http://localhost:* http://127.0.0.1:*",
    },
  });
}

/** Browser-based clients (MCP Inspector) call /register and /token cross-origin. */
function cors(res: Response): Response {
  res.headers.set("access-control-allow-origin", "*");
  res.headers.set("access-control-allow-methods", "POST, OPTIONS");
  res.headers.set("access-control-allow-headers", "content-type, authorization");
  return res;
}

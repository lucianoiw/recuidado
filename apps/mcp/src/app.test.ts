import { createHash, randomBytes } from "node:crypto";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";
import { RecuidadoApi } from "./api.ts";
import { createApp } from "./app.ts";

const FAMILY = "11111111-1111-4111-8111-111111111111";
const LINK = "AbCdEfGhIjKlMnOpQrStUv";
const DEMO = "99999999-9999-4999-8999-999999999999";
const ORIGIN = "https://mcp.test";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

function makeApp() {
  const seen: string[] = [];
  const api = new RecuidadoApi("http://api.test", (async (input: URL, init?: RequestInit) => {
    const url = new URL(input);
    const auth = (init?.headers as Record<string, string> | undefined)?.authorization;
    seen.push(`${url.pathname}${url.search}${auth ? ` ${auth}` : ""}`);
    // Like the API: an unknown patient link is a visitor (demo family).
    const linked = auth === `Bearer p.${LINK}`;
    if (url.pathname === "/family") {
      return Response.json({
        familyId: linked ? FAMILY : DEMO,
        isDemo: !linked,
        patient: { id: "p", name: "Maria", nickname: null, role: "patient", relation: null },
        caregivers: [],
        medications: [],
        today: [],
        unwellReports: [],
      });
    }
    return Response.json({ message: "Not Found" }, { status: 404 });
  }) as typeof fetch);
  const app = createApp({ api, publicUrl: ORIGIN, authSecret: "x".repeat(40) });
  return { app, seen };
}

const call = (app: (r: Request) => Promise<Response>, path: string, init?: RequestInit) => app(new Request(new URL(path, ORIGIN), init));

/** Runs registration, the authorize page and the token exchange like Claude does. */
async function login(app: (r: Request) => Promise<Response>, form: Record<string, string>) {
  const reg = await call(app, "/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ redirect_uris: [REDIRECT], client_name: "Claude" }),
  });
  expect(reg.status).toBe(201);
  const { client_id } = (await reg.json()) as { client_id: string };
  const verifier = randomBytes(32).toString("base64url");
  const params = {
    response_type: "code",
    client_id,
    redirect_uri: REDIRECT,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    state: "abc",
  };
  const page = await call(app, `/authorize?${new URLSearchParams(params)}`);
  expect(page.status).toBe(200);
  expect(await page.text()).toContain("Autorizar");
  const post = await call(app, "/authorize", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, ...form }),
  });
  return { post, client_id, verifier };
}

async function tokenFor(app: (r: Request) => Promise<Response>, form: Record<string, string>) {
  const { post, client_id, verifier } = await login(app, form);
  expect(post.status).toBe(303);
  const back = new URL(post.headers.get("location")!);
  expect(back.searchParams.get("state")).toBe("abc");
  const res = await call(app, "/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: back.searchParams.get("code")!,
      client_id,
      redirect_uri: REDIRECT,
      code_verifier: verifier,
    }),
  });
  expect(res.status).toBe(200);
  return { tokens: (await res.json()) as { access_token: string; refresh_token: string }, client_id };
}

async function mcpClient(app: (r: Request) => Promise<Response>, token: string, path = "/mcp") {
  const client = new Client({ name: "test", version: "1" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(path, ORIGIN), {
      fetch: (input, init) => {
        const req = new Request(input, init);
        req.headers.set("authorization", `Bearer ${token}`);
        return app(req);
      },
    }),
  );
  return client;
}

describe("MCP login", () => {
  it("asks for a token and points to the discovery documents", async () => {
    const { app } = makeApp();
    const res = await call(app, "/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("/.well-known/oauth-protected-resource/mcp");
    const prm = await (await call(app, "/.well-known/oauth-protected-resource/mcp")).json();
    expect(prm.authorization_servers).toEqual([`${ORIGIN}/`]);
    const as = await (await call(app, "/.well-known/oauth-authorization-server")).json();
    expect(as.registration_endpoint).toBe(`${ORIGIN}/register`);
  });

  it("also serves MCP at the root, with its own discovery document", async () => {
    const { app, seen } = makeApp();
    const res = await call(app, "/", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain(`${ORIGIN}/.well-known/oauth-protected-resource"`);
    const prm = await (await call(app, "/.well-known/oauth-protected-resource")).json();
    expect(prm.resource).toBe(`${ORIGIN}/`);
    const page = await call(app, "/", { headers: { accept: "text/html" } });
    expect(page.headers.get("content-type")).toContain("text/html");
    const { tokens } = await tokenFor(app, { action: "demo" });
    const client = await mcpClient(app, tokens.access_token, "/");
    await client.callTool({ name: "get_care_plan", arguments: {} });
    expect(seen.at(-1)).toBe("/family");
    await client.close();
  });

  it("links the demo family with one tap on Autorizar", async () => {
    const { app, seen } = makeApp();
    const { tokens } = await tokenFor(app, { action: "demo" });
    const client = await mcpClient(app, tokens.access_token);
    await client.callTool({ name: "get_care_plan", arguments: {} });
    expect(seen.at(-1)).toBe("/family");
    await client.close();
  });

  it("links a family from its invite link and keeps it on refresh", async () => {
    const { app, seen } = makeApp();
    const { tokens, client_id } = await tokenFor(app, { action: "family", invite: `https://app.recuidado.com.br/m/${LINK}` });
    const refreshed = await call(app, "/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id }),
    });
    const { access_token } = (await refreshed.json()) as { access_token: string };
    const client = await mcpClient(app, access_token);
    await client.callTool({ name: "get_today_doses", arguments: {} });
    expect(seen.at(-1)).toBe(`/family Bearer p.${LINK}`);
    await client.close();
  });

  it("shows an error for an unknown invite", async () => {
    const { app } = makeApp();
    const { post } = await login(app, { action: "family", invite: "https://app.recuidado.com.br/m/NaoExisteEsteLink123" });
    expect(post.status).toBe(400);
    expect(await post.text()).toContain("Não achamos essa família");
  });

  it("refuses a wrong PKCE verifier and a forged token", async () => {
    const { app } = makeApp();
    const { post, client_id } = await login(app, { action: "demo" });
    const code = new URL(post.headers.get("location")!).searchParams.get("code")!;
    const res = await call(app, "/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id, redirect_uri: REDIRECT, code_verifier: "wrong".repeat(10) }),
    });
    expect(res.status).toBe(400);
    const forged = await call(app, "/mcp", {
      method: "POST",
      headers: { authorization: "Bearer abc.def", "content-type": "application/json" },
      body: "{}",
    });
    expect(forged.status).toBe(401);
  });

  it("serves the icons", async () => {
    const { app } = makeApp();
    const icon = await call(app, "/favicon.ico");
    expect(icon.headers.get("content-type")).toBe("image/png");
    expect((await icon.arrayBuffer()).byteLength).toBeGreaterThan(100);
  });
});

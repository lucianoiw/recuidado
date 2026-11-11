/** HTML pages of the MCP server: the home page and the "login" that links a family. Text in pt-BR. */

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const STYLE = `
:root{--bg:#f7f4ee;--ink:#16201f;--muted:#4a5553;--brand:#0b5d57;--danger:#a11d17;--card:#fff;--line:#e3ddd2}
@media (prefers-color-scheme:dark){:root{--bg:#121816;--ink:#eef2f0;--muted:#a9b5b2;--brand:#3fb3a6;--danger:#ff8a80;--card:#1b2321;--line:#2c3633}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:18px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;justify-content:center;padding:40px 16px}
main{width:100%;max-width:440px}
.brand{display:flex;align-items:center;gap:12px;font-weight:700;font-size:22px;margin-bottom:28px}
.brand img{width:44px;height:44px}
h1{font-size:26px;line-height:1.25;margin:0 0 8px}
p{color:var(--muted);margin:0 0 20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin-bottom:16px}
label{display:block;font-weight:600;margin-bottom:8px}
input{width:100%;font:inherit;padding:14px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink)}
button{width:100%;font:inherit;font-weight:700;padding:14px;border-radius:12px;border:0;cursor:pointer;margin-top:12px}
.primary{background:var(--brand);color:#fff}
.secondary{background:transparent;color:var(--brand);border:2px solid var(--brand)}
.link{background:none;color:var(--muted);font-weight:500;margin-top:4px}
.error{color:var(--danger);font-weight:600;margin:0 0 12px}
.small{font-size:15px}
summary{cursor:pointer;color:var(--muted)}\ncode{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:2px 6px;font-size:15px}
`;

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/icon-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/icon-192.png"><style>${STYLE}</style></head>
<body><main><div class="brand"><img src="/icon-192.png" alt="">Recuidado</div>${body}</main></body></html>`;
}

interface AuthorizePageOptions {
  client?: string;
  hidden?: Record<string, string>;
  error?: string;
  fatal?: string;
}

export function authorizePage({ client, hidden = {}, error, fatal }: AuthorizePageOptions): string {
  if (fatal) return layout("Conectar o Recuidado", `<h1>Não deu para conectar</h1><p>${esc(fatal)}</p>`);
  const fields = Object.entries(hidden)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
  return layout(
    "Conectar a família",
    `<h1>Conexão da família</h1>
<p>Esta é a tela de conexão da família no Recuidado. Ao autorizar, o ${esc(client ?? "seu assistente")} passa a ver o plano de remédios da Dona Maria, as doses de hoje e os avisos enviados à família, e pode confirmar uma dose quando você pedir.</p>
<p class="small">Não precisa de senha. É uma demonstração com dados fictícios.</p>
<form method="post" action="/authorize" class="card">${fields}
  ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ""}
  <button class="primary" name="action" value="demo">Autorizar</button>
  <button class="link" name="action" value="cancel">Cancelar</button>
</form>
<details class="card"${error ? " open" : ""}><summary class="small">Cadastrou a sua própria família? Conecte pelo link do app dela</summary>
<form method="post" action="/authorize">${fields}
  <label for="invite" style="margin-top:12px">Link do app da pessoa cuidada (Família, Celular dela, Copiar link)</label>
  <input id="invite" name="invite" placeholder="https://app.recuidado.com.br/m/..." autocomplete="off">
  <button class="secondary" name="action" value="family">Conectar esta família</button>
</form></details>`,
  );
}

export function homePage(mcpUrl: string): string {
  return layout(
    "Recuidado MCP",
    `<h1>Servidor MCP do Recuidado</h1>
<p>Conecte o Recuidado ao Claude, ao ChatGPT ou a outro assistente de IA para perguntar sobre os remédios de quem você cuida.</p>
<div class="card"><label>Endereço do conector</label><code>${esc(mcpUrl)}</code>
<p class="small" style="margin-top:12px">No Claude: Configurações, Conectores, Adicionar conector personalizado. Na hora de conectar, é só tocar em Autorizar.</p></div>
<p class="small"><a href="https://recuidado.com.br" style="color:var(--brand)">recuidado.com.br</a></p>`,
  );
}

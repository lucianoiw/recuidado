/**
 * Origins allowed to call the API. WEB_URL may list several origins separated
 * by commas; each one is also allowed with and without "www." because the web
 * answers on both. The app at app.<domain> also answers at painel.<domain>
 * (the two phones page and /ligacoes), so that origin is allowed too.
 */
export function corsOrigins(webUrl = 'http://localhost:3000'): string[] {
  const origins = new Set<string>();
  for (const raw of webUrl.split(',')) {
    const value = raw.trim();
    if (!value) continue;
    const url = new URL(value);
    origins.add(url.origin);
    if (url.hostname === 'localhost' || /^\d+(\.\d+){3}$/.test(url.hostname)) continue;
    const other = new URL(url.origin);
    other.hostname = url.hostname.startsWith('www.')
      ? url.hostname.slice(4)
      : `www.${url.hostname}`;
    origins.add(other.origin);
    if (url.hostname.startsWith('app.')) {
      const panel = new URL(url.origin);
      panel.hostname = `painel.${url.hostname.slice(4)}`;
      origins.add(panel.origin);
    }
  }
  return [...origins];
}

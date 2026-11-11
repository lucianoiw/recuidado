import { existsSync, statSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const USER_AGENT = "recuidado-data/0.1 (+https://github.com/lucianoiw/recuidado)";

export interface FetchOptions {
  retries?: number;
  timeoutMs?: number;
}

/** GET with retries and exponential backoff. Throws on a non-2xx answer after the last try. */
export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const retries = options.retries ?? 4;
  const timeoutMs = options.timeoutMs ?? 60_000;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return response;
      lastError = new Error(`GET ${url} -> HTTP ${response.status}`);
      if (response.status >= 400 && response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) await sleep(2_000 * 2 ** attempt);
  }
  throw lastError;
}

export async function fetchText(url: string, options?: FetchOptions): Promise<string> {
  return (await fetchWithRetry(url, options)).text();
}

export async function fetchJson<T>(url: string, options?: FetchOptions): Promise<T> {
  return (await fetchWithRetry(url, options)).json() as Promise<T>;
}

/**
 * Downloads a file to `target` unless a cached copy younger than `maxAgeHours` exists.
 * Returns the local path.
 */
export async function downloadFile(url: string, target: string, maxAgeHours = 24): Promise<string> {
  if (existsSync(target)) {
    const ageHours = (Date.now() - statSync(target).mtimeMs) / 3_600_000;
    if (ageHours < maxAgeHours) return target;
  }
  const response = await fetchWithRetry(url, { timeoutMs: 300_000 });
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  return target;
}

/** Absolute URL for an href found on a gov.br page. */
export function absoluteUrl(href: string, base: string): string {
  return new URL(href, base).toString();
}

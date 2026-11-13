/**
 * Prices of every paid service the Recuidado calls, to estimate the cost of each use in US$.
 * List prices checked on 13/11/2026; update here when a provider changes them.
 *
 * - OpenAI: developers.openai.com/api/docs/pricing (gpt-live-1 US$ 0.05 per minute, billed per second;
 *   gpt-6-luna US$ 0.10 input, 0.01 cached input, 0.50 output per 1M tokens).
 * - Anthropic: anthropic.com/claude-sonnet-5-5 (Sonnet 5.5 and Opus 5.5 per 1M tokens).
 * - Nvoip (phone line): Free plan, R$ 0.45 per minute to mobile (Nvoip 2026 price update post).
 */

/** Prices in US$ per 1M tokens. cacheRead/cacheWrite are Anthropic's; cachedInput is OpenAI's. */
export interface TokenPrice {
  input: number;
  output: number;
  cachedInput?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

export const TOKEN_PRICES: Record<string, TokenPrice> = {
  "gpt-6-luna": { input: 0.1, cachedInput: 0.01, output: 0.5 },
  "claude-opus-5-5": { input: 4, cacheRead: 0.2, cacheWrite: 5, output: 20 },
  "claude-sonnet-5-5": { input: 2, cacheRead: 0.1, cacheWrite: 2.5, output: 10 },
  "claude-haiku-5-5": { input: 0.1, cacheRead: 0.01, cacheWrite: 0.125, output: 0.5 },
};

/** Voice models billed by session time, US$ per minute. */
export const VOICE_PRICES_PER_MINUTE: Record<string, number> = {
  "gpt-live-1": 0.05,
};

/** Phone line (Nvoip) in R$ per minute, and the dollar used to convert it (PTAX 12/11/2026). */
export const TELEPHONY_BRL_PER_MINUTE = 0.45;
export const USD_BRL = 5.61;

export interface TokenUsage {
  /**
   * Input tokens as the provider reports them. OpenAI counts cached tokens inside input
   * ("inclusive"); Anthropic counts them apart ("exclusive"), so pass the provider.
   */
  inputTokens?: number;
  outputTokens?: number;
  /** OpenAI cached_tokens or Anthropic cache_read_input_tokens. */
  cacheReadTokens?: number;
  /** Anthropic cache_creation_input_tokens. */
  cacheWriteTokens?: number;
}

export interface Cost {
  inputUsd: number;
  outputUsd: number;
  totalUsd: number;
}

const round = (usd: number) => Math.round(usd * 1e6) / 1e6;

/** Finds the price of a model id, also for dated ids such as "claude-sonnet-5-5-20260928". */
function priceOf<T>(table: Record<string, T>, model: string): T | undefined {
  if (table[model]) return table[model];
  const key = Object.keys(table)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? table[key] : undefined;
}

/** Cost of one LLM request, or undefined when the model has no price here. */
export function tokenCost(provider: string, model: string, usage: TokenUsage): Cost | undefined {
  const price = priceOf(TOKEN_PRICES, model);
  if (!price) return undefined;
  const input = usage.inputTokens ?? 0;
  const cacheRead = usage.cacheReadTokens ?? 0;
  const cacheWrite = usage.cacheWriteTokens ?? 0;
  const inclusive = provider !== "anthropic";
  const freshInput = inclusive ? Math.max(0, input - cacheRead) : input;
  const readPrice = price.cachedInput ?? price.cacheRead ?? price.input;
  const inputUsd =
    (freshInput * price.input + cacheRead * readPrice + cacheWrite * (price.cacheWrite ?? price.input)) / 1e6;
  const outputUsd = ((usage.outputTokens ?? 0) * price.output) / 1e6;
  return { inputUsd: round(inputUsd), outputUsd: round(outputUsd), totalUsd: round(inputUsd + outputUsd) };
}

/** Cost of a voice session billed by the second. */
export function voiceCost(model: string, seconds: number): Cost | undefined {
  const perMinute = priceOf(VOICE_PRICES_PER_MINUTE, model);
  if (perMinute === undefined) return undefined;
  const totalUsd = round((Math.max(0, seconds) / 60) * perMinute);
  return { inputUsd: 0, outputUsd: totalUsd, totalUsd };
}

/**
 * Phone line cost of a call that was answered. Supposition, not confirmed with Nvoip: billed per
 * started 6 s after a 30 s minimum, the usual rule for Brazilian landline and mobile calls.
 */
export function telephonyCost(answeredSeconds: number, brlPerMinute = TELEPHONY_BRL_PER_MINUTE, usdBrl = USD_BRL) {
  if (!(answeredSeconds > 0)) return { billedSeconds: 0, brl: 0, usd: 0 };
  const billedSeconds = Math.max(30, Math.ceil(answeredSeconds / 6) * 6);
  const brl = (billedSeconds / 60) * brlPerMinute;
  return { billedSeconds, brl: Math.round(brl * 1e4) / 1e4, usd: round(brl / usdBrl) };
}

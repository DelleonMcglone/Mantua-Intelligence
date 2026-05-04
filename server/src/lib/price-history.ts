import { logger } from "./logger.ts";
import { TOKENS, type TokenSymbol } from "./tokens.ts";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export type HistoryRange = "1H" | "1D" | "TW" | "1M" | "1Y";

export const HISTORY_RANGES: HistoryRange[] = ["1H", "1D", "TW", "1M", "1Y"];

const RANGE_DAYS: Record<HistoryRange, number> = {
  "1H": 1,
  "1D": 1,
  TW: 7,
  "1M": 30,
  "1Y": 365,
};

const RANGE_TTL_MS: Record<HistoryRange, number> = {
  "1H": 60_000,
  "1D": 5 * 60_000,
  TW: 15 * 60_000,
  "1M": 30 * 60_000,
  "1Y": 60 * 60_000,
};

interface CacheEntry {
  prices: [number, number][];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Per-token historical USD prices over the requested range. CoinGecko
 * `market_chart` returns `[ms, priceUsd]` pairs; granularity is chosen
 * by CG based on `days` (5-min for days=1, hourly for 7-90, daily
 * beyond). We cache per coin+range with TTLs that scale with range
 * length so short views feel live without hammering the free tier.
 */
export async function getPriceHistory(
  symbol: TokenSymbol,
  range: HistoryRange,
): Promise<[number, number][]> {
  const token = TOKENS[symbol];
  const key = `${token.coingeckoId}:${range}`;
  const ttl = RANGE_TTL_MS[range];
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < ttl) {
    return cached.prices;
  }

  const days = RANGE_DAYS[range];
  const url = `${COINGECKO_BASE}/coins/${token.coingeckoId}/market_chart?vs_currency=usd&days=${String(days)}`;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      logger.warn({ status: res.status, symbol, range }, "coingecko market_chart failed");
      return cached?.prices ?? [];
    }
    const body = (await res.json()) as { prices?: [number, number][] };
    const prices = Array.isArray(body.prices) ? body.prices : [];
    cache.set(key, { prices, fetchedAt: Date.now() });
    return prices;
  } catch (err) {
    logger.warn({ err, symbol, range }, "coingecko market_chart errored");
    return cached?.prices ?? [];
  }
}

/**
 * For 1H we still fetch days=1 (CG's smallest unit) and trim to the
 * last hour locally — a separate `1H` `days` value doesn't exist.
 */
export function trimToRange(prices: [number, number][], range: HistoryRange): [number, number][] {
  if (range !== "1H") return prices;
  const cutoff = Date.now() - 60 * 60_000;
  return prices.filter(([ts]) => ts >= cutoff);
}

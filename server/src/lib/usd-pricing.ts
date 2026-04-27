import { z } from "zod";
import { logger } from "./logger.ts";
import { TOKENS, type TokenSymbol, type Token } from "./tokens.ts";

const COINGECKO = "https://api.coingecko.com/api/v3/simple/price";
const TTL_MS = 60_000; // 60s — enough to dampen quote-flow chatter, fresh enough for cap math.

interface CacheEntry {
  usd: number;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

const responseSchema = z.record(z.string(), z.object({ usd: z.number() }));

async function fetchPrices(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const url = `${COINGECKO}?ids=${ids.join(",")}&vs_currencies=usd`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    logger.warn({ status: res.status }, "coingecko price fetch failed");
    return {};
  }
  const parsed = responseSchema.safeParse(await res.json());
  if (!parsed.success) return {};
  const out: Record<string, number> = {};
  for (const [id, value] of Object.entries(parsed.data)) {
    out[id] = value.usd;
  }
  return out;
}

/**
 * Resolve a USD price per unit token. Returns 0 if pricing unavailable
 * (caller should treat that as "skip USD-denominated checks", NOT "free").
 */
export async function getUsdPrice(symbol: TokenSymbol): Promise<number> {
  const token = TOKENS[symbol];
  return getUsdPriceForToken(token);
}

async function getUsdPriceForToken(token: Token): Promise<number> {
  const cached = cache.get(token.coingeckoId);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.usd;
  const fresh = await fetchPrices([token.coingeckoId]);
  const usd = fresh[token.coingeckoId] ?? cached?.usd ?? 0;
  cache.set(token.coingeckoId, { usd, fetchedAt: Date.now() });
  return usd;
}

/** USD value of `amount` (raw base units) for `symbol`. */
export async function tokenAmountUsd(symbol: TokenSymbol, amountRaw: bigint): Promise<number> {
  const token = TOKENS[symbol];
  const price = await getUsdPriceForToken(token);
  if (price === 0) return 0;
  const denom = 10n ** BigInt(token.decimals);
  // Convert via Number for cap-comparison purposes; precision loss is acceptable
  // here (cap is dollar-denominated, not token-denominated).
  const wholeUnits = Number(amountRaw) / Number(denom);
  return wholeUnits * price;
}

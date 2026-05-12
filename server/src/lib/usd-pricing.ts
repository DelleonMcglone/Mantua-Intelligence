import { getTokenPrices } from "./defillama.ts";
import { TOKENS, type TokenSymbol, type Token } from "./tokens.ts";

const TTL_MS = 60_000; // 60s — enough to dampen quote-flow chatter, fresh enough for cap math.

interface CacheEntry {
  usd: number;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Resolve a USD price per unit token. Returns 0 if pricing unavailable
 * (caller should treat that as "skip USD-denominated checks", NOT "free").
 *
 * Routed through DefiLlama Coins (`coins.llama.fi`) — its free tier is
 * open and doesn't rate-limit anonymous callers the way CoinGecko's
 * does. DefiLlama exposes prices keyed by `coingecko:<id>`, so the
 * existing `token.coingeckoId` field drives both sources unchanged.
 */
export async function getUsdPrice(symbol: TokenSymbol): Promise<number> {
  const token = TOKENS[symbol];
  return getUsdPriceForToken(token);
}

async function getUsdPriceForToken(token: Token): Promise<number> {
  const cached = cache.get(token.coingeckoId);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.usd;
  const key = `coingecko:${token.coingeckoId}`;
  const fresh = await getTokenPrices([key]);
  const usd = fresh[key]?.price ?? cached?.usd ?? 0;
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

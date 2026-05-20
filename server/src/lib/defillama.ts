import { z } from "zod";
import { logger } from "./logger.ts";

/**
 * DefiLlama API base URLs. Three subdomains:
 *   - yields.llama.fi  — pool-level yields + APY history (P4-001/P4-002)
 *   - api.llama.fi     — protocol TVL + DEX volume (P7-003)
 *   - coins.llama.fi   — token prices (P7-003)
 *
 * All three are open / unauthenticated. The DEFILLAMA_API_KEY env var
 * exists for the Pro tier; we don't pay it today, so omit the
 * `Authorization` header. If we ever upgrade, route every fetch
 * through a single helper that adds the header conditionally.
 */
const YIELDS_BASE = "https://yields.llama.fi";
const API_BASE = "https://api.llama.fi";
const COINS_BASE = "https://coins.llama.fi";
const TTL_MS = 60_000;

const poolSchema = z
  .object({
    chain: z.string(),
    project: z.string(),
    symbol: z.string(),
    tvlUsd: z.number(),
    apy: z.number().nullable().optional(),
    apyBase: z.number().nullable().optional(),
    pool: z.string(),
    poolMeta: z.string().nullable().optional(),
    underlyingTokens: z.array(z.string()).nullable().optional(),
    volumeUsd1d: z.number().nullable().optional(),
    volumeUsd7d: z.number().nullable().optional(),
    stablecoin: z.boolean().optional(),
    ilRisk: z.string().optional(),
  })
  .loose();

const poolsResponseSchema = z.object({
  data: z.array(poolSchema),
});

const chartPointSchema = z.object({
  timestamp: z.string(),
  tvlUsd: z.number(),
  apy: z.number().nullable().optional(),
  apyBase: z.number().nullable().optional(),
});

const chartResponseSchema = z.object({
  status: z.string(),
  data: z.array(chartPointSchema),
});

export type DefiLlamaPool = z.infer<typeof poolSchema>;
export type DefiLlamaChartPoint = z.infer<typeof chartPointSchema>;

interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.value as T;
  const value = await fetcher();
  cache.set(key, { value, fetchedAt: Date.now() });
  return value;
}

/**
 * P4-001 — list Uniswap pools on Base. Filtered + sorted by TVL desc.
 * Cached for 60s. Uses DefiLlama's open `/pools` endpoint (no auth).
 */
export async function listBasePools(): Promise<DefiLlamaPool[]> {
  return cached("base-pools", async () => {
    const res = await fetch(`${YIELDS_BASE}/pools`);
    if (!res.ok) {
      logger.warn({ status: res.status }, "defillama pools fetch failed");
      return [];
    }
    const json: unknown = await res.json();
    const parsed = poolsResponseSchema.safeParse(json);
    if (!parsed.success) {
      logger.warn({ err: parsed.error.issues }, "defillama pools schema mismatch");
      return [];
    }
    return parsed.data.data
      .filter((p) => p.chain === "Base" && p.project.startsWith("uniswap"))
      .sort((a, b) => b.tvlUsd - a.tvlUsd);
  });
}

/**
 * P4-002 — historical TVL + APY chart for a pool. Returns the last
 * `days` points (DefiLlama records daily). Cached for 60s.
 */
export async function poolChart(poolId: string, days: number): Promise<DefiLlamaChartPoint[]> {
  if (!/^[a-f0-9-]{36}$/i.test(poolId)) {
    throw new Error("Invalid pool id");
  }
  return cached(`chart:${poolId}:${String(days)}`, async () => {
    const res = await fetch(`${YIELDS_BASE}/chart/${poolId}`);
    if (!res.ok) return [];
    const parsed = chartResponseSchema.safeParse(await res.json());
    if (!parsed.success) return [];
    return parsed.data.data.slice(-days);
  });
}

export async function getBasePool(poolId: string): Promise<DefiLlamaPool | null> {
  const all = await listBasePools();
  return all.find((p) => p.pool === poolId) ?? null;
}

/* ───────────────────────── P7-003 query types ───────────────────────── */

const protocolSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string().optional(),
    description: z.string().nullable().optional(),
    logo: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    chains: z.array(z.string()).optional(),
    tvl: z
      .array(
        z.object({
          date: z.number(),
          totalLiquidityUSD: z.number(),
        }),
      )
      .optional(),
    currentChainTvls: z.record(z.string(), z.number()).optional(),
  })
  .loose();

export type DefiLlamaProtocol = z.infer<typeof protocolSchema>;

/**
 * Protocol detail: name, chains, TVL history, per-chain current TVL.
 * Pass a slug like "uniswap" or "aave-v3". Cached for 60s.
 */
export async function getProtocol(slug: string): Promise<DefiLlamaProtocol | null> {
  if (!/^[a-z0-9-]+$/i.test(slug)) {
    throw new Error("Invalid protocol slug");
  }
  return cached(`protocol:${slug.toLowerCase()}`, async () => {
    const res = await fetch(`${API_BASE}/protocol/${slug}`);
    if (!res.ok) {
      logger.warn({ status: res.status, slug }, "defillama protocol fetch failed");
      return null;
    }
    const parsed = protocolSchema.safeParse(await res.json());
    if (!parsed.success) {
      logger.warn({ slug, err: parsed.error.issues }, "defillama protocol schema mismatch");
      return null;
    }
    return parsed.data;
  });
}

const dexOverviewSchema = z
  .object({
    chain: z.string().nullable().optional(),
    totalVolume24h: z.number().nullable().optional(),
    totalVolume7d: z.number().nullable().optional(),
    totalVolume30d: z.number().nullable().optional(),
    change_1d: z.number().nullable().optional(),
    change_7d: z.number().nullable().optional(),
    protocols: z
      .array(
        z
          .object({
            name: z.string(),
            module: z.string().optional(),
            total24h: z.number().nullable().optional(),
            total7d: z.number().nullable().optional(),
            change_1d: z.number().nullable().optional(),
          })
          .loose(),
      )
      .optional(),
  })
  .loose();

export type DefiLlamaDexOverview = z.infer<typeof dexOverviewSchema>;

/**
 * DEX overview for a chain (Base, Ethereum, etc.). Returns aggregated
 * volume + per-protocol breakdown. We always pass the
 * `excludeTotalDataChart{Breakdown}` flags to skip the heavy historical
 * series — those bloat the response into MB. Cached for 60s.
 */
export async function getChainDexOverview(chain: string): Promise<DefiLlamaDexOverview | null> {
  if (!/^[a-z0-9-]+$/i.test(chain)) {
    throw new Error("Invalid chain name");
  }
  return cached(`dexs:${chain.toLowerCase()}`, async () => {
    const url = `${API_BASE}/overview/dexs/${chain}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`;
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn({ status: res.status, chain }, "defillama dex overview fetch failed");
      return null;
    }
    const parsed = dexOverviewSchema.safeParse(await res.json());
    if (!parsed.success) {
      logger.warn({ chain, err: parsed.error.issues }, "defillama dex overview schema mismatch");
      return null;
    }
    return parsed.data;
  });
}

const priceSchema = z.object({
  decimals: z.number().optional(),
  symbol: z.string().optional(),
  price: z.number(),
  timestamp: z.number(),
  confidence: z.number().optional(),
});

const pricesResponseSchema = z.object({
  coins: z.record(z.string(), priceSchema),
});

export type DefiLlamaPrice = z.infer<typeof priceSchema>;

const COIN_KEY = /^[a-z0-9-]+:[a-zA-Z0-9-]+$/;

function validateCoins(coins: readonly string[]): void {
  for (const c of coins) {
    if (!COIN_KEY.test(c)) throw new Error(`Invalid coin key: ${c}`);
  }
}

/**
 * Current token prices for a list of coin keys. Each key is either
 * `coingecko:<id>` or `<chain>:<contract-address>` (e.g.
 * `base:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`).
 *
 * Cached for 60s under a key derived from the sorted coin list (so
 * the cache hits regardless of caller order, but a different set of
 * coins gets a different cache entry).
 */
export async function getTokenPrices(
  coins: readonly string[],
): Promise<Partial<Record<string, DefiLlamaPrice>>> {
  if (coins.length === 0) return {};
  validateCoins(coins);
  const sorted = [...coins].sort();
  return cached(`prices:${sorted.join(",")}`, async () => {
    const res = await fetch(`${COINS_BASE}/prices/current/${sorted.join(",")}`);
    if (!res.ok) {
      logger.warn({ status: res.status }, "defillama prices fetch failed");
      return {};
    }
    const parsed = pricesResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      logger.warn({ err: parsed.error.issues }, "defillama prices schema mismatch");
      return {};
    }
    return parsed.data.coins;
  });
}

const percentageResponseSchema = z.object({
  coins: z.record(z.string(), z.number()),
});

/**
 * Percentage price change for a list of coin keys over the given
 * lookback period. Returns a map keyed by coin string, value is the
 * raw percent (e.g. `1.23` for +1.23%). Cached for 60s.
 *
 * Lookback period strings DefiLlama accepts: `1h`, `24h`, `7d`, `30d`.
 * Default `24h` matches CoinGecko's `usd_24h_change`.
 */
export async function getTokenChangePercents(
  coins: readonly string[],
  period: "1h" | "24h" | "7d" | "30d" = "24h",
): Promise<Partial<Record<string, number>>> {
  if (coins.length === 0) return {};
  validateCoins(coins);
  const sorted = [...coins].sort();
  return cached(`pct:${period}:${sorted.join(",")}`, async () => {
    const url = `${COINS_BASE}/percentage/${sorted.join(",")}?lookForward=false&period=${period}`;
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn({ status: res.status, period }, "defillama percentage fetch failed");
      return {};
    }
    const parsed = percentageResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      logger.warn({ err: parsed.error.issues }, "defillama percentage schema mismatch");
      return {};
    }
    return parsed.data.coins;
  });
}

const chartPriceSchema = z.object({
  timestamp: z.number(),
  price: z.number(),
});

const chartSeriesSchema = z
  .object({
    symbol: z.string().optional(),
    decimals: z.number().optional(),
    confidence: z.number().optional(),
    prices: z.array(chartPriceSchema),
  })
  .loose();

const chartResponseSchema2 = z.object({
  coins: z.record(z.string(), chartSeriesSchema),
});

/**
 * Historical USD price series for a list of coin keys. `daysBack` is
 * the lookback window; `points` is the number of evenly-spaced samples
 * DefiLlama returns within that window (it picks the nearest point to
 * each requested timestamp). Cached per coin+window+points.
 *
 * Returned shape mirrors CoinGecko's `market_chart.prices`: an array
 * of `[timestampMs, priceUsd]` pairs keyed by `coingecko:<id>` so
 * callers can swap sources without rewriting downstream code.
 */
export async function getTokenHistoricalPrices(
  coins: readonly string[],
  daysBack: number,
  points = 100,
): Promise<Partial<Record<string, [number, number][]>>> {
  if (coins.length === 0) return {};
  validateCoins(coins);
  if (!Number.isFinite(daysBack) || daysBack <= 0) {
    throw new Error("daysBack must be a positive number");
  }
  const sorted = [...coins].sort();
  const startSec = Math.floor(Date.now() / 1000) - Math.floor(daysBack * 86400);
  const periodSec = Math.max(60, Math.floor((daysBack * 86400) / points));
  // DefiLlama accepts `period` as a human duration string; format the
  // computed seconds into the smallest valid unit so the API returns
  // ~`points` samples.
  const period = periodSec >= 86400
    ? `${String(Math.max(1, Math.floor(periodSec / 86400)))}d`
    : periodSec >= 3600
      ? `${String(Math.max(1, Math.floor(periodSec / 3600)))}h`
      : `${String(Math.max(1, Math.floor(periodSec / 60)))}m`;
  const cacheKeyStr = `chart:${sorted.join(",")}:d=${String(daysBack)}:n=${String(points)}`;
  return cached(cacheKeyStr, async () => {
    const url = `${COINS_BASE}/chart/${sorted.join(",")}?start=${String(startSec)}&span=${String(points)}&period=${period}`;
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn({ status: res.status, daysBack }, "defillama chart fetch failed");
      return {};
    }
    const parsed = chartResponseSchema2.safeParse(await res.json());
    if (!parsed.success) {
      logger.warn({ err: parsed.error.issues }, "defillama chart schema mismatch");
      return {};
    }
    const out: Record<string, [number, number][]> = {};
    for (const [coin, series] of Object.entries(parsed.data.coins)) {
      out[coin] = series.prices.map((p) => [p.timestamp * 1000, p.price]);
    }
    return out;
  });
}

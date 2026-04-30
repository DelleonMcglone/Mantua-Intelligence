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
): Promise<Record<string, DefiLlamaPrice>> {
  if (coins.length === 0) return {};
  for (const c of coins) {
    if (!/^[a-z0-9-]+:[a-zA-Z0-9-]+$/.test(c)) {
      throw new Error(`Invalid coin key: ${c}`);
    }
  }
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

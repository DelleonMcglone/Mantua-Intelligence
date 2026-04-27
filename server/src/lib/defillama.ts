import { z } from "zod";
import { logger } from "./logger.ts";

const YIELDS_BASE = "https://yields.llama.fi";
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
  .passthrough();

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
export async function poolChart(
  poolId: string,
  days: number,
): Promise<DefiLlamaChartPoint[]> {
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

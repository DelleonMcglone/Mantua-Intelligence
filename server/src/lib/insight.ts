import { z } from "zod";
import { env } from "../env.ts";
import { logger } from "./logger.ts";

/**
 * thirdweb Insight — indexed on-chain data (transactions, events, token
 * balances/metadata) used by the Analyze/Research feature.
 *
 * Auth: server-side calls send the secret key in the `x-secret-key`
 * header. When no key is configured every helper returns `null`/empty so
 * Insight-backed topics degrade gracefully ("not configured") without
 * affecting the rest of Analyze.
 *
 * Base URL is the multichain form `https://insight.thirdweb.com/v1/<path>`
 * with one or more `chain` query params (e.g. `?chain=1&chain=8453`); the
 * per-chain subdomain form `https://<chainId>.insight.thirdweb.com` is
 * equivalent. We use the unified base so a single helper can query
 * several chains at once.
 */

const BASE = "https://insight.thirdweb.com/v1";
const TTL_MS = 60_000;

export function insightConfigured(): boolean {
  return Boolean(env.THIRDWEB_SECRET_KEY);
}

interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

/** A row in any Insight list response — fields vary per endpoint, so we
 *  keep it open and let callers read the keys they need. */
export type InsightRow = Record<string, unknown>;

const envelopeSchema = z
  .object({
    data: z.array(z.record(z.string(), z.unknown())).default([]),
    meta: z
      .object({
        chain_id: z.number().optional(),
        total_items: z.number().optional(),
        limit: z.number().optional(),
        page: z.number().optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

export interface InsightResult {
  data: InsightRow[];
  meta?: Record<string, unknown>;
}

/**
 * Low-level GET against an Insight endpoint. `params` may repeat a key
 * (pass an array) — used for multichain `chain` params. Returns `null`
 * when Insight isn't configured or the request fails (logged, never
 * throws) so callers can fall back cleanly. Cached for 60s per URL.
 */
export async function insightGet(
  path: string,
  params: Record<string, string | number | (string | number)[]> = {},
): Promise<InsightResult | null> {
  const secret = env.THIRDWEB_SECRET_KEY;
  if (!secret) return null;

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, String(v));
    } else {
      qs.append(key, String(value));
    }
  }
  const url = `${BASE}/${path.replace(/^\//, "")}?${qs.toString()}`;
  const cacheKey = url;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.value as InsightResult;

  let res: Response;
  try {
    res = await fetch(url, { headers: { "x-secret-key": secret } });
  } catch (err) {
    logger.warn({ err, path }, "insight fetch threw");
    return null;
  }
  if (!res.ok) {
    logger.warn({ status: res.status, path }, "insight fetch failed");
    return null;
  }
  const parsed = envelopeSchema.safeParse(await res.json());
  if (!parsed.success) {
    logger.warn({ path, err: parsed.error.issues }, "insight schema mismatch");
    return null;
  }
  const result: InsightResult = {
    data: parsed.data.data,
    ...(parsed.data.meta ? { meta: parsed.data.meta } : {}),
  };
  cache.set(cacheKey, { value: result, fetchedAt: Date.now() });
  return result;
}

/* ─────────────────────────── typed helpers ───────────────────────────
 * Param/field names follow Insight's documented v1 surface. Response
 * rows are intentionally loose (InsightRow) — topic runners pull the
 * specific fields they need. Verified against the live API once a key is
 * configured (see scripts/insight-probe).
 */

/** Recent transactions on a chain, optionally filtered to/from an address. */
export async function getTransactions(opts: {
  chainId: number;
  toAddress?: string;
  fromAddress?: string;
  sinceTimestamp?: number;
  limit?: number;
}): Promise<InsightResult | null> {
  const params: Record<string, string | number> = {
    chain: opts.chainId,
    limit: opts.limit ?? 100,
  };
  if (opts.toAddress) params.filter_to_address = opts.toAddress.toLowerCase();
  if (opts.fromAddress) params.filter_from_address = opts.fromAddress.toLowerCase();
  if (opts.sinceTimestamp) params.filter_block_timestamp_gte = opts.sinceTimestamp;
  return insightGet("transactions", params);
}

/** Contract/log events on a chain, optionally filtered to a contract address. */
export async function getEvents(opts: {
  chainId: number;
  contractAddress?: string;
  sinceTimestamp?: number;
  limit?: number;
}): Promise<InsightResult | null> {
  const params: Record<string, string | number> = {
    chain: opts.chainId,
    limit: opts.limit ?? 100,
  };
  if (opts.contractAddress) params.filter_address = opts.contractAddress.toLowerCase();
  if (opts.sinceTimestamp) params.filter_block_timestamp_gte = opts.sinceTimestamp;
  return insightGet("events", params);
}

/** ERC-20 token balances for an owner, across one or more chains. */
export async function getErc20Balances(opts: {
  ownerAddress: string;
  chainIds: number[];
  limit?: number;
}): Promise<InsightResult | null> {
  return insightGet(`tokens/erc20/${opts.ownerAddress.toLowerCase()}`, {
    chain: opts.chainIds,
    limit: opts.limit ?? 100,
  });
}

/**
 * Probe whether Insight returns data for a chain — used to confirm Arc
 * indexing once a key is in place. Returns the row count from a cheap
 * 1-row transactions query, or `null` when unconfigured/unreachable.
 */
export async function probeChainCoverage(chainId: number): Promise<{
  chainId: number;
  reachable: boolean;
  rows: number;
} | null> {
  const result = await getTransactions({ chainId, limit: 1 });
  if (!result) return null;
  return { chainId, reachable: true, rows: result.data.length };
}

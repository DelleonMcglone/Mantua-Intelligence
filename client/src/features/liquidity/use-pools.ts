import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api.ts";
import { TOKENS } from "@/lib/tokens.ts";
import { FEE_TIER_LABELS } from "./fee-tiers.ts";
import { getLocalPools } from "./local-pools.ts";
import type { PoolDetail, PoolSummary, ChartRange } from "./types.ts";

const LOCAL_PREFIX = "local:";

/**
 * Synthesize a `PoolDetail` for a testnet-only pool that lives in
 * localStorage. The server's `/api/pools/:id` only knows about
 * DefiLlama-indexed mainnet pools, so for `local:*` IDs we have to
 * build the detail client-side. TVL/volume/APY aren't tracked locally
 * yet — return zeros so the page renders without errors.
 */
function synthesizeLocalPool(poolId: string): PoolDetail | null {
  const key = poolId.slice(LOCAL_PREFIX.length);
  const local = getLocalPools().find((p) => p.key === key);
  if (!local) return null;
  const underlying: string[] = [TOKENS[local.tokenA].address, TOKENS[local.tokenB].address];
  return {
    pool: {
      id: poolId,
      symbol: `${local.tokenA}-${local.tokenB}`,
      project: "mantua",
      feeTier: FEE_TIER_LABELS[local.fee],
      tvlUsd: 0,
      apy: 0,
      volumeUsd1d: 0,
      volumeUsd7d: 0,
      underlyingTokens: underlying,
    },
    chart: [],
  };
}

interface ListState {
  data: PoolSummary[] | null;
  error: ApiError | Error | null;
  loading: boolean;
}

export function usePools(): ListState {
  const [state, setState] = useState<ListState>({ data: null, error: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    void api
      .get<{ pools: PoolSummary[] }>("/api/pools")
      .then((res) => {
        if (cancelled) return;
        setState({ data: res.pools, error: null, loading: false });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err instanceof Error ? err : new Error("Failed to load pools");
        setState({ data: null, error: e, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

interface DetailState {
  data: PoolDetail | null;
  error: ApiError | Error | null;
  loading: boolean;
}

export function usePool(poolId: string, range: ChartRange): DetailState {
  const [state, setState] = useState<DetailState>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    if (poolId.startsWith(LOCAL_PREFIX)) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        const synth = synthesizeLocalPool(poolId);
        setState(
          synth
            ? { data: synth, error: null, loading: false }
            : { data: null, error: new Error("Pool not found locally"), loading: false },
        );
      });
      return () => {
        cancelled = true;
      };
    }
    void api
      .get<PoolDetail>(`/api/pools/${poolId}?range=${range}`)
      .then((res) => {
        if (cancelled) return;
        setState({ data: res, error: null, loading: false });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err instanceof Error ? err : new Error("Failed to load pool");
        setState({ data: null, error: e, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [poolId, range]);

  return state;
}

import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api.ts";
import type { PoolDetail, PoolSummary, ChartRange } from "./types.ts";

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

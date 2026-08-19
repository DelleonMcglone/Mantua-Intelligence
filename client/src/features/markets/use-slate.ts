import { useEffect, useState } from "react";
import { api } from "@/lib/api.ts";

/** Mirrors the server's `PublicSlate` whitelist (server/src/lib/sports/public-slate.ts). */
export interface SlateTeam {
  key: string;
  name: string;
  abbreviation: string;
  logo?: string;
}

export interface SlateEvent {
  providerEventId: string;
  startsAt: number;
  status: string;
  home: SlateTeam;
  away: SlateTeam;
  homeScore?: number;
  awayScore?: number;
  homeWinProbabilityBps?: number;
  /** True when the probability is the live on-chain pool price. */
  liveOdds?: boolean;
}

export interface Slate {
  league: string;
  delayed: boolean;
  fetchedAt: number;
  events: SlateEvent[];
}

interface SlateResponse {
  leagues: Record<string, Slate | { error: string }>;
}

export interface SlateState {
  /** Per-league slates that loaded; a failed league is simply absent. */
  slates: Partial<Record<string, Slate>>;
  loading: boolean;
  /** True when the whole request failed (not a single league). */
  error: boolean;
}

const REFRESH_MS = 60_000;

/**
 * Games across the covered leagues, refreshed once a minute. Defaults to
 * today's slate; pass `dates` (YYYYMMDD-YYYYMMDD) for a whole week's games.
 * Public — no login needed to browse (B5-007); the server's provider cache
 * makes the poll cheap.
 */
interface SlateInner extends SlateState {
  /** Which `dates` window the state was loaded for. `null` = nothing yet.
   *  Comparing it against the requested window derives `loading` during a
   *  week switch without a setState-in-effect. */
  loadedFor: string | undefined | null;
}

export function useSlate(dates?: string): SlateState {
  const [state, setState] = useState<SlateInner>({
    slates: {},
    loading: true,
    error: false,
    loadedFor: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const query = dates ? `?dates=${encodeURIComponent(dates)}` : "";
        const res = await api.get<SlateResponse>(`/api/sports/slate${query}`);
        if (cancelled) return;
        const slates: Partial<Record<string, Slate>> = {};
        for (const [league, value] of Object.entries(res.leagues)) {
          if (!("error" in value)) slates[league] = value;
        }
        setState({ slates, loading: false, error: false, loadedFor: dates });
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false, error: true, loadedFor: dates }));
        }
      }
    };

    void load();
    const timer = setInterval(() => {
      void load();
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [dates]);

  const switching = state.loadedFor !== null && state.loadedFor !== dates;
  return {
    slates: state.slates,
    error: state.error,
    loading: state.loading || switching,
  };
}

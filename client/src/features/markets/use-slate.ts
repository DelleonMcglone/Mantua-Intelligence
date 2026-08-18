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
 * Today's games across the covered leagues, refreshed once a minute.
 * Public — no login needed to browse (B5-007); the server's provider cache
 * makes the poll cheap.
 */
export function useSlate(): SlateState {
  const [state, setState] = useState<SlateState>({ slates: {}, loading: true, error: false });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await api.get<SlateResponse>("/api/sports/slate");
        if (cancelled) return;
        const slates: Partial<Record<string, Slate>> = {};
        for (const [league, value] of Object.entries(res.leagues)) {
          if (!("error" in value)) slates[league] = value;
        }
        setState({ slates, loading: false, error: false });
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false, error: true }));
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
  }, []);

  return state;
}

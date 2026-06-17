import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api.ts";
import type { PoolSummary } from "@/features/liquidity/types.ts";
import { AgentActionError } from "./agent-gate.tsx";
import { PANEL_BODY, PANEL_HEAD, PANEL_TITLE, Spinner, X_CLOSE } from "./agent-primitives.tsx";

/**
 * F-query — "Query On-Chain Data". Calls the app's `GET /api/pools`
 * endpoint and lists the Arc pools (the same data the Pools page shows,
 * with real on-chain TVL). Read-only, so it needs no provisioned agent
 * wallet.
 */

interface Props {
  onClose: () => void;
}

interface PoolsResponse {
  pools: PoolSummary[];
}

const fmtCompactUsd = (n: number): string =>
  `$${n.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 })}`;

export function QueryFlow({ onClose }: Props) {
  const [pools, setPools] = useState<PoolSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial state is already loading=true / error=null, so the fetch runs
    // straight off mount (deps: [] — runs once); the promise callbacks set
    // the result/error asynchronously.
    let cancelled = false;
    api
      .get<PoolsResponse>("/api/pools")
      .then((data) => {
        if (!cancelled) setPools(data.pools);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load pools",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div style={PANEL_HEAD}>
        <div style={PANEL_TITLE}>Query On-Chain Data</div>
        <button type="button" style={X_CLOSE} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div style={{ ...PANEL_BODY, gap: 8 }}>
        <div style={{ fontSize: 11, color: "var(--text-mute)", letterSpacing: ".06em" }}>
          ARC POOLS BY TVL
        </div>

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0" }}>
            <Spinner agent />
            <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Loading on-chain data…</span>
          </div>
        )}

        {!loading && error && <AgentActionError message={error} />}

        {!loading && !error && pools && pools.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-dim)", padding: "12px 0" }}>
            No pools returned.
          </div>
        )}

        {!loading &&
          !error &&
          pools?.slice(0, 12).map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 0",
                borderBottom: "1px solid var(--border-soft)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.symbol}</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>
                  {p.project}
                  {p.feeTier ? ` · ${p.feeTier}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 13 }}>
                  {fmtCompactUsd(p.tvlUsd)}
                </div>
                {p.apy > 0 && (
                  <div
                    className="mono"
                    style={{ fontSize: 11, color: "var(--green)", marginTop: 1 }}
                  >
                    {p.apy.toFixed(2)}% APY
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
    </>
  );
}

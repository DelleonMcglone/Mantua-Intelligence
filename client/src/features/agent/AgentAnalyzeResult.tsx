import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api.ts";
import { AgentActionError } from "./agent-gate.tsx";
import { DetailRows, Spinner } from "./agent-primitives.tsx";

/**
 * Renders a single `/api/analyze` result inline in the agent chat — the
 * same CoinGecko + DefiLlama + on-chain surface the user's Analyze panel
 * uses. Fetches on mount; remount (via a `key`) to run a different topic.
 */

interface AnalyzeMetric {
  label: string;
  value: string;
}
interface AnalyzeSource {
  name: string;
  url?: string;
}
interface AnalyzeResponse {
  topic: string;
  title: string;
  summary: string;
  metrics?: AnalyzeMetric[];
  bullets?: string[];
  sources?: AnalyzeSource[];
}

export function AgentAnalyzeResult({ topic, symbol }: { topic: string; symbol?: string }) {
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ topic });
    if (symbol) params.set("symbol", symbol);
    api
      .get<AnalyzeResponse>(`/api/analyze?${params.toString()}`)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load data",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [topic, symbol]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Spinner agent />
        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Pulling live data…</span>
      </div>
    );
  }
  if (error) return <AgentActionError message={error} />;
  if (!data) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{data.title}</div>
        <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.55, marginTop: 6 }}>
          {data.summary}
        </p>
      </div>

      {data.metrics && data.metrics.length > 0 && (
        <DetailRows rows={data.metrics.map((m) => ({ label: m.label, value: m.value }))} />
      )}

      {data.bullets && data.bullets.length > 0 && (
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: 13,
            color: "var(--text)",
            lineHeight: 1.6,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {data.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}

      {data.sources && data.sources.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--text-mute)" }}>
          Sources:{" "}
          {data.sources.map((s, i, arr) => (
            <span key={`${s.name}-${String(i)}`}>
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--text-dim)" }}
                >
                  {s.name} ↗
                </a>
              ) : (
                s.name
              )}
              {i < arr.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

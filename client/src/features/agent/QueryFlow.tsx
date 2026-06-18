import { useState, type CSSProperties } from "react";
import { ApiError, api } from "@/lib/api.ts";
import { AgentActionError } from "./agent-gate.tsx";
import {
  BTN_GHOST,
  DetailRows,
  EMBED_BODY,
  PANEL_BODY,
  PANEL_HEAD,
  PANEL_TITLE,
  Spinner,
  X_CLOSE,
} from "./agent-primitives.tsx";

/**
 * F-query — "Query On-Chain Data". Gives the agent the same market +
 * on-chain data surface the user has: it calls `GET /api/analyze` (the
 * endpoint behind the "Analyze & Research" panel), which pulls live
 * CoinGecko prices, DefiLlama volumes, and on-chain Arc v4 pool state.
 * Read-only, so it needs no provisioned agent wallet.
 */

interface Props {
  onClose: () => void;
  /** When true, render inline (no panel header) for the chat. */
  embedded?: boolean;
}

type Topic =
  | "mantua-hooks"
  | "market-summary"
  | "cirbtc-price"
  | "eurc-peg"
  | "top-stablecoins"
  | "usdc-24h-volume"
  | "coinbase-prices";

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

const SUGGESTIONS: { topic: Topic; q: string }[] = [
  { topic: "mantua-hooks", q: "Learn about Mantua hooks" },
  { topic: "market-summary", q: "Stablecoin market summary for USDC and EURC" },
  { topic: "cirbtc-price", q: "Show me cirBTC price" },
  { topic: "eurc-peg", q: "Is EURC holding its peg right now?" },
  { topic: "top-stablecoins", q: "Show me top performing stablecoins" },
  { topic: "usdc-24h-volume", q: "What is USDC's 24h volume trend?" },
  { topic: "coinbase-prices", q: "Coinbase spot prices for USDC, EURC, cirBTC" },
];

const LABEL_STYLE: CSSProperties = {
  fontSize: 11,
  color: "var(--text-mute)",
  letterSpacing: ".06em",
  marginBottom: 8,
};

const CARD_STYLE: CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  background: "var(--bg-elev)",
  border: "1px solid var(--border-soft)",
  borderRadius: 10,
  color: "var(--text)",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
  lineHeight: 1.4,
};

export function QueryFlow({ onClose, embedded = false }: Props) {
  const [view, setView] = useState<"menu" | "result">("menu");
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runQuery = async (topic: Topic) => {
    setView("result");
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await api.get<AnalyzeResponse>(`/api/analyze?topic=${topic}`);
      setData(res);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load data",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!embedded && (
        <div style={PANEL_HEAD}>
          <div style={PANEL_TITLE}>Query On-Chain Data</div>
          <button type="button" style={X_CLOSE} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
      )}

      <div style={{ ...(embedded ? EMBED_BODY : PANEL_BODY), gap: 10 }}>
        {view === "menu" ? (
          <>
            <div style={LABEL_STYLE}>MARKET &amp; ON-CHAIN DATA · COINGECKO · DEFILLAMA</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.topic}
                  type="button"
                  style={CARD_STYLE}
                  onClick={() => {
                    void runQuery(s.topic);
                  }}
                >
                  {s.q}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              style={{ ...BTN_GHOST, alignSelf: "flex-start" }}
              onClick={() => {
                setView("menu");
              }}
            >
              ← Back
            </button>

            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0" }}>
                <Spinner agent />
                <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Pulling live data…</span>
              </div>
            )}

            {!loading && error && <AgentActionError message={error} />}

            {!loading && !error && data && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{data.title}</div>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--text-dim)",
                      lineHeight: 1.55,
                      marginTop: 6,
                    }}
                  >
                    {data.summary}
                  </p>
                </div>

                {data.metrics && data.metrics.length > 0 && (
                  <DetailRows
                    rows={data.metrics.map((m) => ({ label: m.label, value: m.value }))}
                  />
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
            )}
          </>
        )}
      </div>
    </>
  );
}

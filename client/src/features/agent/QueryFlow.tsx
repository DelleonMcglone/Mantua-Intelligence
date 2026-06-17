import { useState, type CSSProperties } from "react";
import { ApiError, api } from "@/lib/api.ts";
import { AgentActionError } from "./agent-gate.tsx";
import {
  BTN_GHOST,
  DetailRows,
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
}

type Topic =
  | "arc-pools"
  | "market-summary"
  | "top-stablecoins"
  | "eurc-peg"
  | "usdc-eurc-pool"
  | "cirbtc-price"
  | "mantua-hooks"
  | "coinbase-prices"
  | "token-price";

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
  { topic: "arc-pools", q: "Live Arc hook pools" },
  { topic: "market-summary", q: "USDC & EURC market summary" },
  { topic: "top-stablecoins", q: "Top stablecoins" },
  { topic: "eurc-peg", q: "Is EURC holding its peg?" },
  { topic: "cirbtc-price", q: "cirBTC price" },
  { topic: "mantua-hooks", q: "About Mantua hooks" },
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

const INPUT_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "10px 12px",
  background: "var(--bg-elev)",
  border: "1px solid var(--border-soft)",
  borderRadius: 10,
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
};

export function QueryFlow({ onClose }: Props) {
  const [view, setView] = useState<"menu" | "result">("menu");
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  const runQuery = async (topic: Topic, symbol?: string) => {
    setView("result");
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({ topic });
      if (symbol) params.set("symbol", symbol);
      const res = await api.get<AnalyzeResponse>(`/api/analyze?${params.toString()}`);
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
      <div style={PANEL_HEAD}>
        <div style={PANEL_TITLE}>Query On-Chain Data</div>
        <button type="button" style={X_CLOSE} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div style={{ ...PANEL_BODY, gap: 10 }}>
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

            <div style={{ ...LABEL_STYLE, marginTop: 6 }}>LOOK UP ANY TOKEN PRICE</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={INPUT_STYLE}
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tokenInput.trim()) {
                    void runQuery("token-price", tokenInput.trim());
                  }
                }}
                placeholder="e.g. ETH, BTC, SOL, PENDLE…"
              />
              <button
                type="button"
                style={{ ...BTN_GHOST, opacity: tokenInput.trim() ? 1 : 0.5 }}
                disabled={!tokenInput.trim()}
                onClick={() => {
                  void runQuery("token-price", tokenInput.trim());
                }}
              >
                Look up
              </button>
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

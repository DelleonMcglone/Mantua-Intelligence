import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { PanelSubHeader } from "@/components/shell/PanelSubHeader.tsx";
import { ApiError, api } from "@/lib/api.ts";

interface AnalyzeMetric {
  label: string;
  value: string;
  hint?: string;
}

interface AnalyzeSource {
  name: string;
  url?: string;
}

interface AnalyzeResponse {
  topic: Topic;
  title: string;
  summary: string;
  metrics?: AnalyzeMetric[];
  bullets?: string[];
  sources?: AnalyzeSource[];
}

type Topic =
  | "eth-price"
  | "eurc-peg"
  | "usdc-eurc-pool"
  | "top-stablecoins"
  | "cbbtc-24h-volume"
  | "mantua-hooks"
  | "token-price";

const SUGGESTIONS: { topic: Topic; question: string }[] = [
  { topic: "mantua-hooks", question: "Learn about Mantua hooks" },
  { topic: "top-stablecoins", question: "Show me top performing Stablecoins" },
  { topic: "usdc-eurc-pool", question: "Analyze USDC/EURC pool health" },
  { topic: "eth-price", question: "What is the current price of ETH?" },
  { topic: "cbbtc-24h-volume", question: "What is cbBTC's 24h volume trend?" },
  { topic: "eurc-peg", question: "Is EURC trading above or below its peg?" },
];

interface AnalyzePanelProps {
  onClose: () => void;
  /** Skip the suggestions screen and run this topic immediately —
   *  used when the chat input matched a known topic. */
  initialTopic?: Topic;
  /** Original free-form question to label the result panel with. */
  initialQuestion?: string;
  /** Token symbol to pass to the `token-price` runner — only
   *  meaningful when initialTopic === "token-price". */
  initialSymbol?: string;
}

/**
 * Analyze & Research panel — backs each suggestion button with a real
 * /api/analyze fetch (CoinGecko prices, DefiLlama Base pools,
 * curated educational copy for hooks). The previous "Phase 7"
 * stub is gone; failures fall back to a plain-error inline message.
 *
 * No standalone chat input lives here — the bottom-right `<InputBar />`
 * (rendered by `App.tsx`) is the only natural-language surface in the
 * prototype.
 */
export function AnalyzePanel({
  onClose,
  initialTopic,
  initialQuestion,
  initialSymbol,
}: AnalyzePanelProps) {
  const [phase, setPhase] = useState<"suggest" | "result">(
    initialTopic ? "result" : "suggest",
  );
  const [active, setActive] = useState<{
    topic: Topic;
    question: string;
    symbol?: string;
  } | null>(
    initialTopic
      ? {
          topic: initialTopic,
          question:
            initialQuestion ??
            (SUGGESTIONS.find((s) => s.topic === initialTopic)?.question ?? ""),
          ...(initialSymbol ? { symbol: initialSymbol } : {}),
        }
      : null,
  );
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (phase !== "result" || !active) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    const params = new URLSearchParams({ topic: active.topic });
    if (active.symbol) params.set("symbol", active.symbol);
    api
      .get<AnalyzeResponse>(`/api/analyze?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Unknown error";
        setError(msg);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [phase, active, reloadKey]);

  function runQuery(topic: Topic, question: string) {
    setActive({ topic, question });
    setPhase("result");
    setReloadKey((k) => k + 1);
  }
  function retry() {
    setReloadKey((k) => k + 1);
  }

  return (
    <>
      <PanelHeader />

      <PanelSubHeader
        {...(phase !== "suggest"
          ? {
              onBack: () => {
                setPhase("suggest");
              },
            }
          : {})}
        title={
          phase === "suggest" ? (
            "Analyze & Research"
          ) : (
            <>
              Research — <span className="text-accent">{active?.question}</span>
            </>
          )
        }
        subtitle={
          phase === "suggest"
            ? "Pick a suggestion or type what you want to analyze."
            : "Agentic token & protocol analysis."
        }
        onClose={onClose}
      />

      <div className="px-5 py-3.5 flex-1 overflow-auto">
        {phase === "suggest" && (
          <>
            {initialQuestion && (
              <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3 mb-4 text-[13px] text-text-dim">
                Got your question:{" "}
                <span className="text-text">"{initialQuestion}"</span>
                <div className="text-[11px] text-text-mute mt-1">
                  I don't have a dedicated runner for this yet — pick a related
                  suggestion below or rephrase.
                </div>
              </div>
            )}
            <div className="text-[11px] text-text-mute tracking-[0.08em] mb-2.5 font-semibold">
              SUGGESTED QUESTIONS
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.topic}
                  type="button"
                  onClick={() => {
                    runQuery(s.topic, s.question);
                  }}
                  className="flex items-center px-3.5 py-3.5 bg-bg-elev border border-border-soft rounded-md cursor-pointer text-left text-[13px] leading-snug font-medium min-h-[56px] hover:border-accent transition-colors"
                >
                  {s.question}
                </button>
              ))}
            </div>
          </>
        )}

        {phase === "result" && (
          <ResultBody data={data} loading={loading} error={error} onRetry={retry} />
        )}
      </div>
    </>
  );
}

function ResultBody({
  data,
  loading,
  error,
  onRetry,
}: {
  data: AnalyzeResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="bg-bg-elev border border-border-soft rounded-md p-5 text-[13px] text-text-dim">
        Pulling live data…
      </div>
    );
  }
  if (error) {
    const isRateLimit = /429|rate.?limit/i.test(error);
    return (
      <div className="bg-bg-elev border border-red/40 rounded-md p-5 text-[13px] text-red space-y-2">
        <div>{error}</div>
        {isRateLimit && (
          <div className="text-text-dim text-[12px]">
            CoinGecko's free tier rate-limits aggressive callers. The server caches
            successful responses for 5 minutes; one successful fetch will be served
            from cache for everyone after that.
          </div>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1.5 rounded-xs border border-red/40 bg-transparent text-red text-[12px] cursor-pointer hover:bg-red/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="bg-bg-elev border border-border-soft rounded-md p-5">
        <div className="font-semibold text-text text-[15px] mb-2">{data.title}</div>
        <p className="text-[13px] text-text leading-relaxed">{data.summary}</p>
      </div>

      {data.metrics && data.metrics.length > 0 && (
        <div className="bg-bg-elev border border-border-soft rounded-md p-5">
          <div className="text-[10px] text-text-mute tracking-[0.08em] font-semibold mb-3">
            METRICS
          </div>
          <dl className="grid grid-cols-1 gap-y-2.5">
            {data.metrics.map((m, i) => (
              <div
                key={`${m.label}-${String(i)}`}
                className="flex items-center justify-between text-[13px]"
              >
                <dt className="text-text-dim">{m.label}</dt>
                <dd className="font-mono text-text">{m.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {data.bullets && data.bullets.length > 0 && (
        <div className="bg-bg-elev border border-border-soft rounded-md p-5">
          <ul className="space-y-2 text-[13px] text-text leading-relaxed list-disc list-outside pl-4 marker:text-text-mute">
            {data.bullets.map((b, i) => (
              <li key={String(i)}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {data.sources && data.sources.length > 0 && (
        <div className="text-[11px] text-text-mute">
          Sources:{" "}
          {data.sources.map((s, i) => (
            <span key={`${s.name}-${String(i)}`}>
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-dim hover:text-accent inline-flex items-center gap-0.5"
                >
                  {s.name} <ExternalLink className="h-2.5 w-2.5" />
                </a>
              ) : (
                <span>{s.name}</span>
              )}
              {i < data.sources!.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

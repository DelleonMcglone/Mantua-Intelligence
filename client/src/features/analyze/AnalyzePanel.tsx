import { useState } from "react";
import { History, Plus, X, ArrowLeft } from "lucide-react";

const SUGGESTIONS = [
  "What is the current price of ETH?",
  "Is EURC trading above or below its peg?",
  "Analyze USDC/USDT pool health",
  "Show me top performing RWA tokens",
  "What is cbBTC's 24h volume trend?",
  "Learn about Mantua hooks",
];

interface AnalyzePanelProps {
  onClose: () => void;
}

/**
 * Mantua Prototype — `AnalyzePanel` (panels_more.jsx). Implements the
 * "suggest" phase of the design: 6 suggestion cards in a 2x2 grid, free-
 * text input. The deep "loading + results" phases (chart, sentiment, risk
 * breakdown) are stubbed to a "Research coming soon" placeholder until
 * the DefiLlama route lands (Phase 7).
 */
export function AnalyzePanel({ onClose }: AnalyzePanelProps) {
  const [phase, setPhase] = useState<"suggest" | "stub">("suggest");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  function runQuery(q: string) {
    setQuery(q);
    setInput("");
    setPhase("stub");
  }

  return (
    <>
      <div className="flex items-start gap-2.5 px-5 pt-4 pb-3.5 border-b border-border-soft">
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-semibold -tracking-[0.01em]">Ask Mantua</div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-xs border border-border bg-transparent text-text-dim text-[12px] inline-flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> New chat
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-xs border border-border bg-transparent text-text-dim text-[12px] inline-flex items-center gap-1.5"
          >
            <History className="h-3.5 w-3.5" /> History
          </button>
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            {phase !== "suggest" && (
              <button
                type="button"
                onClick={() => {
                  setPhase("suggest");
                }}
                className="mt-0.5 h-7 w-7 inline-flex items-center justify-center rounded-xs border border-border-soft bg-transparent text-text-dim"
                aria-label="Back"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="min-w-0">
              <div className="text-[18px] font-semibold">
                {phase === "suggest" ? (
                  "Analyze & Research"
                ) : (
                  <>
                    Research — <span className="text-accent">{query}</span>
                  </>
                )}
              </div>
              <div className="text-[13px] text-text-dim mt-0.5">
                {phase === "suggest"
                  ? "Pick a suggestion or type what you want to analyze."
                  : "Agentic token & protocol analysis."}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 inline-flex items-center justify-center rounded-xs border border-border-soft bg-transparent text-text-dim"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="px-5 py-3.5 flex-1 overflow-auto">
        {phase === "suggest" && (
          <>
            <div className="text-[11px] text-text-mute tracking-[0.08em] mb-2.5 font-semibold">
              SUGGESTED QUESTIONS
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    runQuery(q);
                  }}
                  className="flex items-center px-3.5 py-3.5 bg-bg-elev border border-border-soft rounded-md cursor-pointer text-left text-[13px] leading-snug font-medium min-h-[56px] hover:border-accent transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) runQuery(input.trim());
              }}
            >
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                }}
                placeholder="Ask about a token, pool, or protocol…"
                className="w-full bg-bg-elev border border-border-soft rounded-md px-4 py-3 text-[13px] outline-none focus:border-accent"
              />
            </form>
          </>
        )}

        {phase === "stub" && (
          <div className="bg-bg-elev border border-border-soft rounded-md p-5 text-[13px] text-text-dim leading-relaxed">
            <div className="font-semibold text-text mb-1">
              Research is on the way.
            </div>
            The full analyze + research flow lights up once the DefiLlama route
            lands in Phase 7. Until then, suggestions navigate to this stub.
          </div>
        )}
      </div>
    </>
  );
}

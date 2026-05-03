import { useState } from "react";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { PanelSubHeader } from "@/components/shell/PanelSubHeader.tsx";

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
 * "suggest" phase of the design: 6 suggestion cards in a 2x2 grid.
 * The deep loading + results phases (chart, sentiment, risk breakdown)
 * are stubbed to a "Research coming soon" placeholder until the
 * DefiLlama route lands (Phase 7).
 *
 * No standalone chat input lives here — the bottom-right `<InputBar />`
 * (rendered by `App.tsx`) is the only natural-language surface in the
 * prototype. See chat2 of the Mantua handoff bundle.
 */
export function AnalyzePanel({ onClose }: AnalyzePanelProps) {
  const [phase, setPhase] = useState<"suggest" | "stub">("suggest");
  const [query, setQuery] = useState("");

  function runQuery(q: string) {
    setQuery(q);
    setPhase("stub");
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
              Research — <span className="text-accent">{query}</span>
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
          </>
        )}

        {phase === "stub" && (
          <div className="bg-bg-elev border border-border-soft rounded-md p-5 text-[13px] text-text-dim leading-relaxed">
            <div className="font-semibold text-text mb-1">Research is on the way.</div>
            The full analyze + research flow lights up once the DefiLlama route lands in
            Phase 7. Until then, suggestions navigate to this stub.
          </div>
        )}
      </div>
    </>
  );
}

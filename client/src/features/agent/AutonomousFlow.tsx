import { useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { useAgentPortfolio } from "./use-agent-portfolio.ts";
import { AgentNotReady, AgentUnavailableNotice, AgentWalletStrip } from "./agent-gate.tsx";
import { BTN_GHOST, PANEL_BODY } from "./agent-primitives.tsx";

/**
 * F7 — Autonomous mode. Drives off the LIVE agent wallet
 * (`useAgentPortfolio`). The example prompts below are illustrative
 * suggestions. The previous mock theater — fake parse → confirm →
 * execute → done steps with hardcoded amounts, hooks, a daily cap, and a
 * fabricated tx hash — is gone; autonomous execution isn't wired yet, so
 * picking an instruction shows an honest notice instead of faking a run.
 */

interface Props {
  onClose: () => void;
  /** Back returns to the agent mode picker. */
  onBack?: () => void;
}

const AUTONOMOUS_PROMPTS = [
  "Swap 0.1 ETH to USDC on Base",
  "Move my idle USDC into the highest-APR stable pool",
  "Monitor cbBTC price and alert if it drops below $60k",
  "Rebalance my portfolio to 60% ETH / 40% USDC",
];

export function AutonomousFlow({ onClose, onBack }: Props) {
  const agent = useAgentPortfolio();
  const [instr, setInstr] = useState<string | null>(null);

  return (
    <>
      <PanelHeader />

      <div className="px-5 pt-4 pb-3.5 flex items-center justify-between gap-2.5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="h-7 px-2 inline-flex items-center gap-1 rounded-xs border border-border-soft bg-transparent text-text-dim text-[12px] hover:text-text"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        ) : (
          <span className="w-[60px]" />
        )}
        <div className="text-[15px] font-semibold inline-flex items-center gap-2">
          <span aria-hidden>🤖</span> Autonomous Mode
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-7 w-7 inline-flex items-center justify-center rounded-xs border border-border-soft bg-transparent text-text-dim hover:text-text"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!agent.agentAddress ? (
        <AgentNotReady agent={agent} />
      ) : (
        <>
          <AgentWalletStrip agent={agent} />
          {instr === null ? (
            <div className="flex-1 overflow-auto px-5 pt-2 pb-5 flex flex-col">
              <div className="flex flex-col items-center text-center mt-8 mb-6 gap-2">
                <div className="text-[56px] leading-none" aria-hidden>
                  🤖
                </div>
                <div className="text-[20px] font-semibold mt-1">Your autonomous agent is ready</div>
                <div className="text-[13px] text-text-dim">
                  Pick an example instruction to get started
                </div>
              </div>
              <div className="flex flex-col gap-2.5 max-w-[560px] w-full mx-auto">
                {AUTONOMOUS_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setInstr(p);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 bg-bg-elev border border-border-soft rounded-md text-left text-[13px] text-text hover:border-accent hover:bg-row-hover transition-colors cursor-pointer"
                  >
                    <span className="text-accent text-[14px] leading-none">›</span>
                    <span className="flex-1">{p}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={PANEL_BODY}>
              <div style={{ fontSize: 11, color: "var(--text-mute)", letterSpacing: ".06em" }}>
                INSTRUCTION
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--text)",
                  padding: "10px 12px",
                  background: "var(--bg-elev)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 10,
                }}
              >
                {instr}
              </div>
              <AgentUnavailableNotice action="autonomous execution" />
              <button
                type="button"
                style={{ ...BTN_GHOST, alignSelf: "flex-start" }}
                onClick={() => {
                  setInstr(null);
                }}
              >
                Try another instruction
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

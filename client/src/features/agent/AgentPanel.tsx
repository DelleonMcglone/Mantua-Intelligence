import { useState } from "react";
import { History, Plus, X, ArrowLeft } from "lucide-react";
import { api, ApiError } from "../../lib/api";

const CHAT_ACTIONS = [
  { k: "wallet", t: "Create & Manage Wallet", d: "Create agent wallet via CDP", e: "🔑" },
  { k: "send", t: "Send Tokens", d: "Transfer tokens to any address", e: "📩" },
  { k: "swap", t: "Swap Tokens", d: "Exchange between tokens in agent wallet", e: "🔄" },
  { k: "liq", t: "Liquidity", d: "Add/remove liquidity from a pool", e: "💧" },
  { k: "query", t: "Query On-Chain Data", d: "Fetch any crypto data", e: "🔍" },
  { k: "fund", t: "Fund Agent Wallet", d: "Get tokens", e: "🚰" },
] as const;

interface AgentWalletDto {
  address: string;
  cdpWalletId: string;
  label: string | null;
  dailyCapUsd: string;
  status: string;
  createdAt: string;
}

type WalletState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; wallet: AgentWalletDto }
  | { kind: "error"; message: string };

interface AgentPanelProps {
  onClose: () => void;
}

type Step = "mode" | "chat" | "auto";

/**
 * Mantua Prototype — `AgentPanel` (chat.jsx). Implements the mode picker
 * (Chat / Autonomous) + Chat-mode action grid. The autonomous
 * conversational deep flow stubs to a placeholder until Phase 6
 * `agentic-wallet-skills` integration lands (P6-009 → P6-012).
 */
export function AgentPanel({ onClose }: AgentPanelProps) {
  const [step, setStep] = useState<Step>("mode");
  const [walletState, setWalletState] = useState<WalletState>({ kind: "idle" });

  const handleWalletAction = async (): Promise<void> => {
    if (walletState.kind === "loading") return;
    setWalletState({ kind: "loading" });
    try {
      const wallet = await api.post<AgentWalletDto>("/api/agent/wallet", {});
      setWalletState({ kind: "success", wallet });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to provision agent wallet";
      setWalletState({ kind: "error", message });
    }
  };

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

      {step === "mode" && (
        <>
          <div className="px-5 pt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 inline-flex items-center justify-center rounded-xs border border-border-soft bg-transparent text-text-dim"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="px-7 py-7 flex-1 overflow-auto flex flex-col items-center">
            <div className="text-[40px] leading-none mt-4">🤖</div>
            <div className="text-[22px] font-bold mt-4 -tracking-[0.01em]">Choose Agent Mode</div>
            <div className="text-[13px] text-text-dim mt-1.5">
              How would you like to interact with the agent?
            </div>
            <div className="grid grid-cols-2 gap-3 mt-7 w-full max-w-[480px]">
              <button
                type="button"
                onClick={() => {
                  setStep("chat");
                }}
                className="text-left p-4 bg-bg-elev border border-border-soft rounded-md cursor-pointer hover:border-accent transition-all min-h-[140px]"
              >
                <div className="text-[26px]">💬</div>
                <div className="text-[15px] font-bold mt-5">Chat Mode</div>
                <div className="text-[12px] text-text-dim mt-1.5 leading-snug">
                  Interactive action cards with guided steps
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("auto");
                }}
                className="text-left p-4 bg-bg-elev border border-border-soft rounded-md cursor-pointer hover:border-accent transition-all min-h-[140px]"
              >
                <div className="text-[26px]">🤖</div>
                <div className="text-[15px] font-bold mt-5">Autonomous Mode</div>
                <div className="text-[12px] text-text-dim mt-1.5 leading-snug">
                  Give the agent an instruction & it executes autonomously
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {step === "chat" && (
        <>
          <div className="px-5 pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setStep("mode");
              }}
              className="px-3 py-1.5 rounded-xs border border-border bg-transparent text-text-dim text-[12px] inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <div className="text-[15px] font-semibold inline-flex items-center gap-2">
              <span className="text-base">💬</span> Chat Mode
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
          <div className="p-5 flex-1 overflow-auto">
            <div className="grid grid-cols-3 gap-3">
              {CHAT_ACTIONS.map((a) => {
                const cardClass =
                  "text-left p-3.5 bg-bg-elev border border-border-soft rounded-md min-h-[120px] flex flex-col";
                const inner = (
                  <>
                    <div className="text-[22px]">{a.e}</div>
                    <div className="text-[13px] font-bold mt-3 leading-tight">{a.t}</div>
                    <div className="text-[11px] text-text-dim mt-1 leading-snug">{a.d}</div>
                  </>
                );
                if (a.k === "wallet") {
                  return (
                    <button
                      key={a.k}
                      type="button"
                      onClick={() => {
                        void handleWalletAction();
                      }}
                      disabled={walletState.kind === "loading"}
                      className={`${cardClass} cursor-pointer hover:border-accent transition-all disabled:opacity-60 disabled:cursor-wait`}
                    >
                      {inner}
                    </button>
                  );
                }
                return (
                  <div key={a.k} className={cardClass}>
                    {inner}
                  </div>
                );
              })}
            </div>
            {walletState.kind === "idle" && (
              <div className="mt-4 text-[11px] text-text-mute italic">
                Action handlers light up under Phase 6 (P6-003 → P6-012). Click "Create &amp; Manage
                Wallet" to provision your agent wallet (P6-003).
              </div>
            )}
            {walletState.kind === "loading" && (
              <div className="mt-4 text-[11px] text-text-dim">Provisioning agent wallet…</div>
            )}
            {walletState.kind === "success" && (
              <div className="mt-4 p-3 bg-bg-elev border border-border-soft rounded-md text-[11px] leading-relaxed">
                <div className="font-semibold text-text mb-1">Agent wallet ready.</div>
                <div className="text-text-dim">
                  Address: <code className="font-mono break-all">{walletState.wallet.address}</code>
                </div>
                <div className="text-text-mute mt-1">
                  Daily cap ${walletState.wallet.dailyCapUsd}. Funding flow lands once the design
                  source adds a Fund step (P6-003 follow-up).
                </div>
              </div>
            )}
            {walletState.kind === "error" && (
              <div className="mt-4 p-3 bg-bg-elev border border-border-soft rounded-md text-[11px] text-text-dim">
                <div className="font-semibold text-text mb-1">Couldn't create agent wallet.</div>
                <div>{walletState.message}</div>
              </div>
            )}
          </div>
        </>
      )}

      {step === "auto" && (
        <>
          <div className="px-5 pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setStep("mode");
              }}
              className="px-3 py-1.5 rounded-xs border border-border bg-transparent text-text-dim text-[12px] inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <div className="text-[15px] font-semibold inline-flex items-center gap-2">
              <span className="text-base">🤖</span> Autonomous Mode
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
          <div className="px-5 py-5 flex-1 overflow-auto">
            <div className="bg-bg-elev border border-border-soft rounded-md p-5 text-[13px] text-text-dim leading-relaxed">
              <div className="font-semibold text-text mb-1">Autonomous mode is wiring up.</div>
              The conversational instruction-execution flow lands under Phase 6 (P6-009 → P6-012)
              once the `agentic-wallet-skills` integration is in place.
            </div>
          </div>
        </>
      )}
    </>
  );
}

import { ArrowLeft, History, Plus, X } from "lucide-react";

const CHAT_ACTIONS = [
  { k: "wallet", t: "Create & Manage Wallet", d: "Create agent wallet via CDP", e: "🔑" },
  { k: "send", t: "Send Tokens", d: "Transfer tokens to any address", e: "📩" },
  { k: "swap", t: "Swap Tokens", d: "Exchange between tokens in agent wallet", e: "🔄" },
  { k: "liq", t: "Liquidity", d: "Add/remove liquidity from a pool", e: "💧" },
  { k: "query", t: "Query On-Chain Data", d: "Fetch any crypto data", e: "🔍" },
  { k: "fund", t: "Fund Agent Wallet", d: "Get tokens", e: "🚰" },
] as const;

export type ChatActionKey = (typeof CHAT_ACTIONS)[number]["k"];

interface Props {
  onBackToMode: () => void;
  onClose: () => void;
  onPick: (k: ChatActionKey) => void;
}

/**
 * Chat-mode action grid — entry point into per-action flows
 * (F1 Wallet, F2 Send, F3 Swap, etc.). Cards that haven't shipped a
 * flow yet are inert. Same Tailwind + lucide chrome as the
 * user-reverted production style.
 */
export function AgentChatGrid({ onBackToMode, onClose, onPick }: Props) {
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
      <div className="px-5 pt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToMode}
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
          {CHAT_ACTIONS.map((a) => (
            <button
              key={a.k}
              type="button"
              onClick={() => {
                onPick(a.k);
              }}
              className="text-left p-3.5 bg-bg-elev border border-border-soft rounded-md min-h-[120px] flex flex-col cursor-pointer hover:border-accent transition-all"
            >
              <div className="text-[22px]">{a.e}</div>
              <div className="text-[13px] font-bold mt-3 leading-tight">{a.t}</div>
              <div className="text-[11px] text-text-dim mt-1 leading-snug">{a.d}</div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

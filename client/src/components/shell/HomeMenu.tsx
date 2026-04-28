import { ArrowUpDown, BarChart3, Bot, Droplet, History, Plus } from "lucide-react";
import { Logo } from "./Logo.tsx";

export type HomePromptId = "pool" | "swap" | "analyze" | "agent";

interface Props {
  onPromptSelect: (id: HomePromptId) => void;
  onNewChat: () => void;
  onHistory: () => void;
}

const PROMPTS: { id: HomePromptId; title: string; icon: typeof Droplet }[] = [
  { id: "pool", title: "Create / Add Liquidity with Stable protection", icon: Droplet },
  { id: "swap", title: "Swap Stablecoins", icon: ArrowUpDown },
  { id: "analyze", title: "Analyze and research your favorite token or protocol", icon: BarChart3 },
  { id: "agent", title: "Create / Manage Agent", icon: Bot },
];

/**
 * Default right-column view — matches prototype `HomeMenu` in panels.jsx.
 * Header strip ("Ask Mantua" + New chat / History buttons), greeting line
 * with the Mantua avatar, and a 2x2 grid of prompt cards. Click any card
 * to navigate to the matching panel.
 */
export function HomeMenu({ onPromptSelect, onNewChat, onHistory }: Props) {
  return (
    <>
      <div className="flex items-start gap-2.5 px-5 pt-4 pb-3.5 border-b border-border-soft">
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-semibold -tracking-[0.01em]">Ask Mantua</div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNewChat}
            className="px-3 py-1.5 rounded-xs border border-border bg-transparent text-text-dim text-[12px] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> New chat
          </button>
          <button
            type="button"
            onClick={onHistory}
            className="px-3 py-1.5 rounded-xs border border-border bg-transparent text-text-dim text-[12px] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <History className="h-3.5 w-3.5" /> History
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-start gap-3 mb-2.5">
          <div className="w-7 h-7 rounded-xs bg-bg-elev border border-border-soft flex items-center justify-center flex-shrink-0">
            <Logo size={22} />
          </div>
          <div>
            <div className="text-[17px] font-medium">What can I help you with?</div>
            <div className="text-[13px] text-text-dim mt-1">
              Try some of the prompts below or use your own to begin.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3.5">
          {PROMPTS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onPromptSelect(p.id);
                }}
                className="bg-bg-elev border border-border-soft rounded-md p-4 min-h-[105px] cursor-pointer flex flex-col justify-between transition-all text-left hover:border-accent hover:bg-row-hover"
              >
                <div className="text-[13px] leading-snug text-text">{p.title}</div>
                <div className="text-text-dim mt-6">
                  <Icon className="h-4 w-4" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

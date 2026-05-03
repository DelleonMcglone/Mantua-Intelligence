import { History, Plus } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  onNewChat?: () => void;
  onHistory?: () => void;
  right?: ReactNode;
}

/**
 * Shared "Ask Mantua" header strip — matches `PanelHeader` in
 * `mantua-ai/project/src/panels.jsx` (used at the top of every right-
 * column panel: Home, PoolList, Swap, AddLiquidity, Analyze, Agent).
 *
 * The right-column Card always renders this strip first, then the
 * panel-specific subheader (e.g. "Swap", "Create Pool"), then the
 * panel body, then the shared `<InputBar />` at the bottom.
 */
export function PanelHeader({ onNewChat, onHistory, right }: Props) {
  return (
    <div className="flex items-start gap-2.5 px-5 pt-4 pb-3.5 border-b border-border-soft">
      <div className="flex-1 min-w-0">
        <div className="text-[17px] font-semibold -tracking-[0.01em]">Ask Mantua</div>
      </div>
      <div className="flex gap-2">
        {right}
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
  );
}

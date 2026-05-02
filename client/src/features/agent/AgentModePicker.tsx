import { History, Plus, X } from "lucide-react";

interface Props {
  onClose: () => void;
  onPickChat: () => void;
  onPickAutonomous: () => void;
}

/**
 * Mode picker entry — "Choose Agent Mode" with Chat / Autonomous tiles.
 * Lifted out of `AgentPanel.tsx` so the router file stays under the
 * project's 150-line limit. Uses the existing Tailwind + lucide chrome
 * (matches the user-reverted production style).
 */
export function AgentModePicker({ onClose, onPickChat, onPickAutonomous }: Props) {
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
            onClick={onPickChat}
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
            onClick={onPickAutonomous}
            className="text-left p-4 bg-bg-elev border border-border-soft rounded-md cursor-pointer hover:border-accent transition-all min-h-[140px]"
          >
            <div className="text-[26px]">🤖</div>
            <div className="text-[15px] font-bold mt-5">Autonomous Mode</div>
            <div className="text-[12px] text-text-dim mt-1.5 leading-snug">
              Give the agent an instruction &amp; it executes autonomously
            </div>
          </button>
        </div>
      </div>
    </>
  );
}

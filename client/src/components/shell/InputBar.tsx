import { useState } from "react";
import { ChevronDown, Send, Settings } from "lucide-react";

interface Props {
  onSubmit: (text: string) => void;
}

/**
 * Persistent chat input bar — sits at the bottom of the right-column
 * card and matches prototype `InputBar` in app.jsx. Submits route
 * commands ("swap", "liquidity", "positions") to the parent so the
 * panel can switch routes; free-form text starts a chat conversation
 * (chat surface is a follow-on slice).
 */
export function InputBar({ onSubmit }: Props) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="px-5 pt-3.5 pb-4 border-t border-border-soft">
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-bg-elev rounded-md border border-border-soft">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Ask Mantua anything or type a trade command..."
          className="flex-1 bg-transparent border-none outline-none text-[13px] text-text"
        />
        <button
          type="button"
          onClick={submit}
          className="bg-transparent border-none text-text-dim cursor-pointer flex p-1"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex gap-2 items-center">
        <button
          type="button"
          className="px-2.5 py-1 rounded-full border border-border bg-bg-elev text-text-dim text-[12px] inline-flex items-center gap-1.5"
        >
          <span className="w-2 h-2 rounded-full" style={{ background: "#0052ff" }} />
          Base
          <ChevronDown className="h-3 w-3" />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          className="px-2.5 py-1 rounded-xs border border-border bg-transparent text-text-dim text-[11px] inline-flex items-center cursor-pointer"
          aria-label="Settings"
        >
          <Settings className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}

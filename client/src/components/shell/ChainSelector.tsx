import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  CHAIN_INFO,
  SUPPORTED_TESTNET_CHAIN_IDS,
  type SupportedTestnetChainId,
} from "@/lib/chains.ts";
import { useChainSelector } from "@/lib/chain-context.tsx";

/**
 * Chain selector chip — replaces the static "Base" chip from the
 * pre-PR-101 InputBar. Click opens a dropdown of supported chains;
 * picking one calls `wallet.switchChain` so the user's wallet actually
 * follows the selection. The chip's dot color comes from each chain's
 * brand color in `CHAIN_INFO`.
 */
export function ChainSelector() {
  const { chainId, setChainId, switching } = useChainSelector();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = CHAIN_INFO[chainId];

  function handlePick(id: SupportedTestnetChainId) {
    setOpen(false);
    void setChainId(id);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        disabled={switching}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Selected chain: ${active.displayName}. Click to change.`}
        className="px-2.5 py-1 rounded-full border border-border bg-bg-elev text-text-dim text-[12px] inline-flex items-center gap-1.5 cursor-pointer hover:text-text disabled:opacity-60 disabled:cursor-wait"
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: active.dotColor }}
        />
        {switching ? "Switching…" : active.shortName}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-[calc(100%+6px)] left-0 z-30 bg-panel-solid border border-border rounded-sm p-1 min-w-[200px] shadow-lg"
        >
          {SUPPORTED_TESTNET_CHAIN_IDS.map((id) => {
            const info = CHAIN_INFO[id];
            const selected = id === chainId;
            return (
              <button
                key={id}
                type="button"
                role="menuitem"
                onClick={() => {
                  handlePick(id);
                }}
                className="flex w-full items-center justify-between px-3 py-2 border-none rounded-xs bg-transparent hover:bg-chip text-text text-[13px] text-left cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: info.dotColor }}
                  />
                  {info.displayName}
                </span>
                {selected && <Check className="h-3.5 w-3.5 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

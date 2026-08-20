import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  CHAIN_INFO,
  SUPPORTED_TESTNET_CHAIN_IDS,
  networkKeyForChain,
  type SupportedTestnetChainId,
} from "@/lib/chains.ts";
import { useChainSwitch } from "@/lib/chain-context.tsx";
import { NetworkLogo } from "./network-icons.tsx";

interface Props {
  /** Which way the dropdown opens: "up" for the input dock (default),
   *  "down" for the header. */
  direction?: "up" | "down";
}

/**
 * Chain selector chip — official network logos (Base Square, Arc mark),
 * Base Sepolia default. Click opens a dropdown of supported chains;
 * picking one calls `wallet.switchChain` via the chain context so the
 * user's wallet actually follows the selection. Rendered in the header
 * (down) and under the chat input (up).
 */
export function ChainSelector({ direction = "up" }: Props) {
  const { chainId, setChainId, switching } = useChainSwitch();
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
        <NetworkLogo network={networkKeyForChain(chainId)} size={14} />
        {switching ? "Switching…" : active.shortName}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-30 bg-panel-solid border border-border rounded-sm p-1 min-w-[200px] shadow-lg ${
            direction === "up" ? "bottom-[calc(100%+6px)] left-0" : "top-[calc(100%+6px)] right-0"
          }`}
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
                  <NetworkLogo network={networkKeyForChain(id)} size={16} />
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

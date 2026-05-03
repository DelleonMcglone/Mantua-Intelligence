import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { TOKENS, USER_FACING_TOKEN_SYMBOLS, type TokenSymbol } from "@/lib/tokens.ts";
import { TokenIcon } from "./TokenIcon.tsx";

interface TokenSelectorProps {
  value: TokenSymbol;
  onChange: (s: TokenSymbol) => void;
  disabledSymbol?: TokenSymbol;
}

/**
 * Pill-style token picker — matches the design's `TokenPicker`
 * (panels_more.jsx:307). Click to open a popover anchored under the
 * pill with each user-facing Base Sepolia token. WETH is hidden;
 * routing wraps ETH internally.
 */
export function TokenSelector({ value, onChange, disabledSymbol }: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-panel-solid border border-border hover:border-text-mute transition-colors text-[14px] font-medium cursor-pointer"
      >
        <TokenIcon symbol={value} size={20} />
        <span>{value}</span>
        <ChevronDown className="h-3 w-3 text-text-mute" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 min-w-[160px] bg-panel-solid border border-border rounded-md p-1 shadow-xl">
          {USER_FACING_TOKEN_SYMBOLS.map((sym) => {
            const tk = TOKENS[sym];
            const disabled = sym === disabledSymbol;
            return (
              <button
                key={sym}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  onChange(sym);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 w-full px-2.5 py-2 rounded-xs text-left text-[13px] ${
                  sym === value ? "bg-chip" : ""
                } ${
                  disabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-row-hover cursor-pointer"
                }`}
              >
                <TokenIcon symbol={sym} size={18} />
                <span className="flex-1">{tk.symbol}</span>
                {tk.native && (
                  <span className="text-[10px] text-text-mute uppercase">Native</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

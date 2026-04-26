import { ChevronDown } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { TOKENS, TOKEN_SYMBOLS, type TokenSymbol } from "@/lib/tokens.ts";
import { cn } from "@/lib/utils.ts";

interface TokenSelectorProps {
  value: TokenSymbol;
  onChange: (s: TokenSymbol) => void;
  disabledSymbol?: TokenSymbol;
}

export function TokenSelector({ value, onChange, disabledSymbol }: TokenSelectorProps) {
  const t = TOKENS[value];
  return (
    <Dialog>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-sm",
            "bg-bg-elev border border-border hover:border-text-mute",
            "transition-colors text-sm font-medium",
          )}
        >
          <span className="font-mono">{t.symbol}</span>
          <ChevronDown className="h-3.5 w-3.5 text-text-mute" />
        </button>
      </DialogPrimitive.Trigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Select token</DialogTitle>
        </DialogHeader>
        <ul className="space-y-1">
          {TOKEN_SYMBOLS.map((sym) => {
            const tk = TOKENS[sym];
            const disabled = sym === disabledSymbol;
            return (
              <li key={sym}>
                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (!disabled) onChange(sym);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 rounded-sm",
                      "text-left transition-colors",
                      sym === value && "bg-chip",
                      !disabled && "hover:bg-chip cursor-pointer",
                      disabled && "opacity-40 cursor-not-allowed",
                    )}
                  >
                    <div>
                      <div className="font-mono text-sm">{tk.symbol}</div>
                      <div className="text-xs text-text-dim">{tk.name}</div>
                    </div>
                    {tk.native && (
                      <span className="text-[10px] text-text-mute uppercase">Native</span>
                    )}
                  </button>
                </DialogPrimitive.Close>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

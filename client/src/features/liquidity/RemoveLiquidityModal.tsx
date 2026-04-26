import { useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useConfirmedAction } from "@/hooks/use-confirmed-action.tsx";
import type { Position } from "./positions-types.ts";
import { SlippageRow } from "./SlippageRow.tsx";
import { useRemoveLiquidity } from "./use-remove-liquidity.ts";
import { tokenLabelByAddress } from "./token-labels.ts";

const BASESCAN_TX = "https://basescan.org/tx/";
const PRESETS = [25, 50, 75, 100] as const;

interface Props {
  position: Position | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function RemoveLiquidityModal({ position, onClose, onSuccess }: Props) {
  const [percentage, setPercentage] = useState<number>(50);
  const [slippageBps, setSlippageBps] = useState(50);
  const confirm = useConfirmedAction();
  const remove = useRemoveLiquidity();

  if (!position) return null;
  const isFull = percentage === 100;
  const sym = `${tokenLabelByAddress(position.token0)}/${tokenLabelByAddress(position.token1)}`;
  const ready = position.tokenId !== null && position.latestSqrtPriceX96 !== null;

  async function onSubmit() {
    if (!position || !ready) return;
    const ok = await confirm({
      title: `Remove ${String(percentage)}% from ${sym}`,
      description: `${isFull ? "This will burn the position NFT." : "Position stays open with reduced liquidity."} Slippage tolerance ${(slippageBps / 100).toFixed(2)}%.`,
      severity: isFull ? "warning" : "default",
      doubleConfirm: isFull || slippageBps >= 100,
      confirmLabel: isFull ? "Burn position" : "Remove",
    });
    if (!ok) return;
    await remove.execute({
      positionId: position.id,
      percentage,
      sqrtPriceX96: position.latestSqrtPriceX96 ?? "0",
      slippageBps,
    });
    if (remove.state.status === "success") onSuccess();
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove liquidity · {sym}</DialogTitle>
          <DialogDescription>
            Token #{position.tokenId ?? "—"} · liquidity {position.liquidity}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-text-dim mb-2 uppercase tracking-wider">Amount to remove</p>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPercentage(p);
                  }}
                  className={`py-2 rounded-sm border text-sm font-medium transition-colors ${
                    percentage === p
                      ? "border-accent bg-chip text-text"
                      : "border-border-soft bg-bg-elev text-text-dim hover:text-text"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          <SlippageRow value={slippageBps} onChange={setSlippageBps} />

          {!ready && (
            <p className="text-xs text-amber">
              {position.tokenId === null
                ? "This position was created before tokenId capture — remove not available."
                : "No price reference for this pool — add liquidity once via Mantua to enable remove."}
            </p>
          )}

          {remove.state.txHash && (
            <a
              href={`${BASESCAN_TX}${remove.state.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent hover:text-accent-2 inline-flex items-center gap-1"
            >
              View on BaseScan <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {remove.state.status === "error" && remove.state.error && (
            <p className="text-xs text-red">{remove.state.error.message}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={isFull ? "destructive" : "primary"}
            disabled={!ready || remove.state.status !== "idle"}
            onClick={() => {
              void onSubmit();
            }}
          >
            {remove.state.status === "preparing"
              ? "Preparing…"
              : remove.state.status === "signing"
                ? "Sign in wallet…"
                : remove.state.status === "pending"
                  ? "Confirming…"
                  : remove.state.status === "success"
                    ? "Done"
                    : isFull
                      ? "Burn position"
                      : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { Card } from "@/components/shell/Card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { BASESCAN_TX } from "@/lib/tokens.ts";
import { FEE_TIER_LABELS } from "./fee-tiers.ts";
import { isFeeTier } from "./fee-tiers-helpers.ts";
import { RemoveLiquidityModal } from "./RemoveLiquidityModal.tsx";
import { tokenLabelByAddress } from "./token-labels.ts";
import { usePositions } from "./use-positions.ts";
import type { Position } from "./positions-types.ts";

export function PositionsList() {
  const { data, error, loading, reload } = usePositions();
  const [removing, setRemoving] = useState<Position | null>(null);

  return (
    <Card className="flex-1 flex flex-col p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-border-soft flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Your positions</h2>
        <span className="text-xs text-text-mute">
          Showing positions opened in Mantua.{" "}
          <a href="/docs/external-positions" className="border-b border-dotted">
            External positions coming soon
          </a>
        </span>
      </div>

      {loading && (
        <p className="px-5 py-8 text-xs text-text-dim text-center">Loading positions…</p>
      )}
      {error && (
        <p className="px-5 py-8 text-xs text-red text-center">
          Failed to load positions: {error.message}
        </p>
      )}
      {data && data.length === 0 && (
        <p className="px-5 py-8 text-xs text-text-dim text-center">
          No open positions. Create a pool and add liquidity to see one here.
        </p>
      )}

      {data && data.length > 0 && (
        <ul className="flex-1 overflow-auto">
          {data.map((p) => (
            <PositionRow key={p.id} position={p} onRemove={setRemoving} />
          ))}
        </ul>
      )}

      <RemoveLiquidityModal
        position={removing}
        onClose={() => {
          setRemoving(null);
        }}
        onSuccess={() => {
          setRemoving(null);
          reload();
        }}
      />
    </Card>
  );
}

function PositionRow({
  position,
  onRemove,
}: {
  position: Position;
  onRemove: (p: Position) => void;
}) {
  const sym = `${tokenLabelByAddress(position.token0)}/${tokenLabelByAddress(position.token1)}`;
  const feeLabel = isFeeTier(position.fee) ? FEE_TIER_LABELS[position.fee] : `${String(position.fee / 10_000)}%`;
  return (
    <li className="px-5 py-3 border-b border-border-soft flex items-center gap-3">
      <div className="flex-1">
        <div className="text-sm font-medium font-mono">{sym}</div>
        <div className="text-[11px] text-text-dim">
          {feeLabel} · token #{position.tokenId ?? "—"} · liquidity {truncateLong(position.liquidity)}
        </div>
        {position.openedTx && (
          <a
            href={`${BASESCAN_TX}${position.openedTx}`}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-text-mute hover:text-accent inline-flex items-center gap-1 mt-1"
          >
            opened tx <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onRemove(position);
        }}
      >
        <Trash2 className="h-3 w-3" /> Remove
      </Button>
    </li>
  );
}

function truncateLong(s: string): string {
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

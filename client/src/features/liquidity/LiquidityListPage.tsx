import { ChevronRight, Plus } from "lucide-react";
import { Card } from "@/components/shell/Card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { usePools } from "./use-pools.ts";
import { formatPct, formatUsd, normalizePairSymbol } from "./format.ts";
import type { PoolSummary } from "./types.ts";

interface Props {
  onSelectPool: (poolId: string) => void;
  onCreate: () => void;
}

export function LiquidityListPage({ onSelectPool, onCreate }: Props) {
  const { data, error, loading } = usePools();

  return (
    <Card className="flex-1 flex flex-col p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-border-soft flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Liquidity Pools</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-mute">Base · Uniswap</span>
          <Button variant="ghost" size="sm" onClick={onCreate}>
            <Plus className="h-3 w-3" /> New pool
          </Button>
        </div>
      </div>

      {loading && <p className="px-5 py-8 text-xs text-text-dim text-center">Loading pools…</p>}

      {error && (
        <p className="px-5 py-8 text-xs text-red text-center">
          Failed to load pools: {error.message}
        </p>
      )}

      {data && data.length === 0 && (
        <p className="px-5 py-8 text-xs text-text-dim text-center">No pools available.</p>
      )}

      {data && data.length > 0 && (
        <ul className="flex-1 overflow-auto">
          <li className="grid grid-cols-[1fr_auto_auto_auto_24px] gap-3 px-5 py-2 text-[10px] uppercase tracking-wider text-text-mute border-b border-border-soft">
            <span>Pool</span>
            <span className="text-right">TVL</span>
            <span className="text-right">Vol 24h</span>
            <span className="text-right">APY</span>
            <span />
          </li>
          {data.slice(0, 50).map((p) => (
            <PoolRow key={p.id} pool={p} onSelect={onSelectPool} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function PoolRow({ pool, onSelect }: { pool: PoolSummary; onSelect: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onSelect(pool.id);
        }}
        className="grid grid-cols-[1fr_auto_auto_auto_24px] gap-3 items-center w-full px-5 py-3 hover:bg-row-hover transition-colors text-left border-b border-border-soft"
      >
        <div>
          <div className="text-sm font-medium font-mono">
            {normalizePairSymbol(pool.symbol)}
          </div>
          <div className="text-[11px] text-text-dim">
            {pool.project} {pool.feeTier ? `· ${pool.feeTier}` : ""}
          </div>
        </div>
        <span className="text-sm font-mono text-right">{formatUsd(pool.tvlUsd)}</span>
        <span className="text-sm font-mono text-right text-text-dim">
          {formatUsd(pool.volumeUsd1d)}
        </span>
        <span className="text-sm font-mono text-right text-green">{formatPct(pool.apy)}</span>
        <ChevronRight className="h-4 w-4 text-text-mute" />
      </button>
    </li>
  );
}

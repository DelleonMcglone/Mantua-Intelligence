import { useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Card } from "@/components/shell/Card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { usePool } from "./use-pools.ts";
import { TvlChart } from "./TvlChart.tsx";
import { MetricToggle, RangeToggle, type Metric } from "./Toggles.tsx";
import { formatPct, formatUsd, normalizePairSymbol } from "./format.ts";
import type { ChartRange } from "./types.ts";

const BASESCAN = "https://basescan.org";

interface Props {
  poolId: string;
  onBack: () => void;
}

export function PoolDetailPage({ poolId, onBack }: Props) {
  const [range, setRange] = useState<ChartRange>("30D");
  const [metric, setMetric] = useState<Metric>("tvl");
  const { data, error, loading } = usePool(poolId, range);

  return (
    <Card className="flex-1 flex flex-col p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-border-soft flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to pool list"
          className="text-text-dim hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-base font-semibold flex-1">
          {data ? normalizePairSymbol(data.pool.symbol) : "Loading…"}
        </h2>
        {data?.pool.feeTier && (
          <span className="text-xs text-text-mute font-mono">{data.pool.feeTier}</span>
        )}
      </div>

      {loading && <p className="px-5 py-8 text-xs text-text-dim text-center">Loading pool…</p>}
      {error && (
        <p className="px-5 py-8 text-xs text-red text-center">
          Failed to load pool: {error.message}
        </p>
      )}

      {data && (
        <div className="flex-1 overflow-auto p-5 space-y-5">
          <Stats
            tvl={data.pool.tvlUsd}
            apy={data.pool.apy}
            vol24={data.pool.volumeUsd1d}
            vol7d={data.pool.volumeUsd7d}
          />

          <div className="flex items-center justify-between">
            <RangeToggle value={range} onChange={setRange} />
            <MetricToggle value={metric} onChange={setMetric} />
          </div>

          <TvlChart points={data.chart} metric={metric} />

          <div className="flex gap-2">
            <Button variant="primary" size="md" disabled className="flex-1">
              Add liquidity (Phase 4b)
            </Button>
            <Button variant="ghost" size="md" disabled>
              Remove (4c)
            </Button>
          </div>

          {data.pool.underlyingTokens.length > 0 && (
            <div className="text-xs text-text-mute space-y-1">
              <p className="uppercase tracking-wider text-[10px]">Underlying</p>
              {data.pool.underlyingTokens.map((addr) => (
                <a
                  key={addr}
                  href={`${BASESCAN}/address/${addr}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-text-dim hover:text-accent inline-flex items-center gap-1"
                >
                  {addr.slice(0, 6)}…{addr.slice(-4)} <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Stats({
  tvl,
  apy,
  vol24,
  vol7d,
}: {
  tvl: number;
  apy: number;
  vol24: number;
  vol7d: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCell label="TVL" value={formatUsd(tvl)} />
      <StatCell label="APY" value={formatPct(apy)} />
      <StatCell label="Volume 24h" value={formatUsd(vol24)} />
      <StatCell label="Volume 7d" value={formatUsd(vol7d)} />
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-elev rounded-sm p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-mute">{label}</div>
      <div className="text-base font-mono mt-1">{value}</div>
    </div>
  );
}

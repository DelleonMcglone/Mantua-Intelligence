import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { PanelSubHeader } from "@/components/shell/PanelSubHeader.tsx";
import { Button } from "@/components/ui/button.tsx";
import { BASESCAN_URL } from "@/lib/tokens.ts";
import type { PoolKeyContext } from "./AddLiquidityForm.tsx";
import { tryDeriveAddCtx } from "./defillama-translator.ts";
import { usePool } from "./use-pools.ts";
import { usePoolState } from "./use-pool-state.ts";
import { TvlChart } from "./TvlChart.tsx";
import { MetricToggle, RangeToggle, type Metric } from "./Toggles.tsx";
import { formatPct, formatUsd, normalizePairSymbol } from "./format.ts";
import type { ChartRange } from "./types.ts";

const BASESCAN = BASESCAN_URL;

interface Props {
  poolId: string;
  onBack: () => void;
  onAddLiquidity: (ctx: PoolKeyContext) => void;
  onClose?: () => void;
}

export function PoolDetailPage({ poolId, onBack, onAddLiquidity, onClose }: Props) {
  const [range, setRange] = useState<ChartRange>("30D");
  const [metric, setMetric] = useState<Metric>("tvl");
  const { data, error, loading } = usePool(poolId, range);

  const derived = data ? tryDeriveAddCtx(data.pool) : null;
  const poolState = usePoolState(
    derived?.tokenA ?? null,
    derived?.tokenB ?? null,
    derived?.fee ?? null,
  );
  const addStatus = computeAddStatus(derived, poolState);

  return (
    <>
      <PanelHeader />
      <PanelSubHeader
        title={data ? normalizePairSymbol(data.pool.symbol) : "Loading…"}
        {...(data?.pool.feeTier ? { subtitle: data.pool.feeTier } : {})}
        onBack={onBack}
        {...(onClose ? { onClose } : {})}
      />

      {loading && <p className="px-5 py-8 text-xs text-text-dim text-center">Loading pool…</p>}
      {error && (
        <p className="px-5 py-8 text-xs text-red text-center">
          Failed to load pool: {error.message}
        </p>
      )}

      {data && (
        <div className="flex-1 overflow-auto px-5 pt-2 pb-5 space-y-5">
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

          <div className="space-y-1">
            <Button
              variant="primary"
              size="md"
              disabled={!addStatus.enabled}
              onClick={() => {
                if (addStatus.enabled && derived) onAddLiquidity(derived);
              }}
              className="w-full"
            >
              {addStatus.label}
            </Button>
            {addStatus.hint && (
              <p className="text-[11px] text-text-mute text-center">{addStatus.hint}</p>
            )}
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
    </>
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

interface AddStatus {
  enabled: boolean;
  label: string;
  hint: string | null;
}

function computeAddStatus(
  derived: ReturnType<typeof tryDeriveAddCtx>,
  poolState: ReturnType<typeof usePoolState>,
): AddStatus {
  if (!derived) {
    return {
      enabled: false,
      label: "Add liquidity",
      hint: "Pair not in Mantua's supported token set yet.",
    };
  }
  if (poolState.loading) return { enabled: false, label: "Checking pool…", hint: null };
  if (poolState.error) {
    return { enabled: false, label: "Add liquidity", hint: "Couldn't check pool state." };
  }
  if (!poolState.data?.exists) {
    return {
      enabled: false,
      label: "Add liquidity",
      hint: "No v4 pool at this fee tier — create one from the Liquidity tab.",
    };
  }
  return { enabled: true, label: "Add liquidity", hint: null };
}

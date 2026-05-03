import { useMemo, useRef, useState, useEffect } from "react";
import { ArrowLeft, ArrowUp, ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { PanelSubHeader } from "@/components/shell/PanelSubHeader.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useConfirmedAction } from "@/hooks/use-confirmed-action.tsx";
import { BASESCAN_TX, type TokenSymbol } from "@/lib/tokens.ts";
import { TokenSelector } from "@/features/swap/TokenSelector.tsx";
import { FEE_TIER_LABELS, type FeeTier } from "./fee-tiers.ts";
import { TokenPairIcon } from "./TokenPairIcon.tsx";
import { safeParse } from "./create-helpers.ts";
import { addCtaLabel } from "./add-helpers.ts";
import { useAddLiquidity } from "./use-add-liquidity.ts";

export interface PoolKeyContext {
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  fee: FeeTier;
  /** Set by the pool-create flow with the just-initialized price.
   *  Omitted when entering from PoolDetailPage — server reads slot0. */
  sqrtPriceX96?: string;
}

interface Props {
  ctx: PoolKeyContext;
  onBack: () => void;
  onClose?: () => void;
}

const HOOKS = [
  { name: "No Hook", desc: "Standard execution" },
  { name: "Stable Protection", desc: "Minimizes depeg & slippage" },
  { name: "Dynamic Fee", desc: "Fees adjust to volatility" },
  { name: "RWAgate", desc: "Compliance-gated routing" },
  { name: "Async Limit Order", desc: "Off-chain matching, on-chain settle" },
];

const RANGE_OPTIONS = ["Full", "Wide", "Narrow", "Custom"] as const;
type RangeOption = (typeof RANGE_OPTIONS)[number];

const CHART_RANGES = ["1D", "7D", "30D"] as const;
type ChartRange = (typeof CHART_RANGES)[number];

/**
 * Add-Liquidity panel — implements `AddLiquidityPanel` from
 * `mantua-ai/project/src/panels.jsx:266`. Layout:
 *
 *   inline pair header (back + token pair + hook badge) ·
 *   "Fee · TVL · APY" stats row ·
 *   chart tabs (Volume / TVL) + range toggle (1D/7D/30D) + sparkline ·
 *   two TokenInput cards with flip button ·
 *   LIQUIDITY HOOK dropdown + PRICE RANGE toggle ·
 *   Fee Tier · Hook Benefit · Review & Sign Position
 *
 * Backed by the same `useAddLiquidity` wiring as before — the layout
 * change is presentational; calldata + approvals path is unchanged.
 */
export function AddLiquidityForm({ ctx, onBack, onClose }: Props) {
  const [amountA, setAmountA] = useState("0.0");
  const [amountB, setAmountB] = useState("0.0");
  const [chartRange, setChartRange] = useState<ChartRange>("7D");
  const [chartTab, setChartTab] = useState<"volume" | "tvl">("volume");
  const [hook, setHook] = useState(HOOKS[0]!);
  const [showHooks, setShowHooks] = useState(false);
  const [range, setRange] = useState<RangeOption>("Full");
  const hookRef = useRef<HTMLDivElement | null>(null);
  const confirm = useConfirmedAction();
  const add = useAddLiquidity();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!hookRef.current) return;
      if (!hookRef.current.contains(e.target as Node)) setShowHooks(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  const amountARaw = safeParse(ctx.tokenA, amountA);
  const amountBRaw = safeParse(ctx.tokenB, amountB);
  const ready = amountARaw !== "0" && amountBRaw !== "0";

  async function onSubmit() {
    if (!ready) return;
    const ok = await confirm({
      title: `Add liquidity to ${ctx.tokenA}/${ctx.tokenB}`,
      description: `${amountA} ${ctx.tokenA} + ${amountB} ${ctx.tokenB} · fee ${FEE_TIER_LABELS[ctx.fee]} · range ${range}`,
      confirmLabel: "Approve & add",
    });
    if (!ok) return;
    await add.execute({
      tokenA: ctx.tokenA,
      tokenB: ctx.tokenB,
      fee: ctx.fee,
      amountARaw,
      amountBRaw,
      ...(ctx.sqrtPriceX96 ? { sqrtPriceX96: ctx.sqrtPriceX96 } : {}),
      slippageBps: 50,
    });
  }

  function flip() {
    const a = amountA;
    setAmountA(amountB);
    setAmountB(a);
  }

  return (
    <>
      <PanelHeader />
      <PanelSubHeader
        title="Create Pool"
        subtitle="Explore and manage your liquidity positions."
        {...(onClose ? { onClose } : {})}
      />

      <div className="flex-1 overflow-auto px-5 pt-2 pb-5">
        {/* Inline pair header */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="h-7 w-7 inline-flex items-center justify-center rounded-xs border border-border-soft bg-transparent text-text-dim hover:text-text"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <TokenPairIcon a={ctx.tokenA} b={ctx.tokenB} size={22} />
          <div className="text-[14px] font-semibold">
            {ctx.tokenA} / {ctx.tokenB}
          </div>
          <span className="px-1.5 py-px rounded-[6px] text-[10px] font-medium tracking-[0.04em] bg-chip text-text-mute border border-border-soft uppercase">
            {hook.name === "No Hook" ? "No Hook" : hook.name}
          </span>
        </div>

        {/* Mini stats row */}
        <div className="flex gap-3.5 text-[12px] text-text-dim mb-3.5">
          <span className="text-green inline-flex items-center gap-0.5">
            ↗ {feeTierToPct(FEE_TIER_LABELS[ctx.fee])} Fee
          </span>
          <span>TVL — —</span>
          <span>APY — —</span>
        </div>

        {/* Chart tabs + range toggle */}
        <div className="flex items-center gap-4 text-[12px] border-b border-border-soft pb-2">
          <button
            type="button"
            onClick={() => {
              setChartTab("volume");
            }}
            className={`pb-1.5 -mb-2 ${chartTab === "volume" ? "text-text font-medium border-b-2 border-amber" : "text-text-dim"}`}
          >
            Volume
          </button>
          <button
            type="button"
            onClick={() => {
              setChartTab("tvl");
            }}
            className={`pb-1.5 -mb-2 ${chartTab === "tvl" ? "text-text font-medium border-b-2 border-amber" : "text-text-dim"}`}
          >
            TVL
          </button>
          <div className="flex-1" />
          <div className="flex gap-0.5 bg-bg-elev p-0.5 rounded-md border border-border-soft">
            {CHART_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setChartRange(r);
                }}
                className={`px-2 py-1 text-[11px] rounded-xs font-medium ${
                  chartRange === r
                    ? "bg-green/30 text-green"
                    : "bg-transparent text-text-dim"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="mt-2.5">
          <div className="text-[11px] text-text-mute mb-1">
            {ctx.tokenA}/{ctx.tokenB} Price
          </div>
          <Sparkline />
        </div>

        {/* Token inputs + flip button */}
        <div
          className="grid items-stretch mt-4 gap-2"
          style={{ gridTemplateColumns: "1fr auto 1fr" }}
        >
          <TokenInputCard
            label={ctx.tokenA}
            sym={ctx.tokenA}
            amount={amountA}
            onAmountChange={setAmountA}
            onSymbolChange={() => undefined}
            disabledSymbol={ctx.tokenB}
          />
          <button
            type="button"
            onClick={flip}
            aria-label="Flip token order"
            className="self-center h-7 w-7 inline-flex items-center justify-center rounded-xs border border-border-soft bg-transparent text-text-dim"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <TokenInputCard
            label={ctx.tokenB}
            sym={ctx.tokenB}
            amount={amountB}
            onAmountChange={setAmountB}
            onSymbolChange={() => undefined}
            disabledSymbol={ctx.tokenA}
          />
        </div>

        {/* Hook + Range */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <div className="text-[10px] text-text-mute tracking-[0.08em] mb-1.5 font-semibold">
              LIQUIDITY HOOK
            </div>
            <div className="relative" ref={hookRef}>
              <button
                type="button"
                onClick={() => {
                  setShowHooks((v) => !v);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-bg-elev border border-border-soft rounded-md cursor-pointer text-left"
              >
                <ArrowUp className="h-3.5 w-3.5 text-text-dim" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium">{hook.name}</div>
                  <div className="text-[11px] text-text-dim">{hook.desc}</div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-text-dim" />
              </button>
              {showHooks && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-panel-solid border border-border rounded-md p-1 shadow-xl">
                  {HOOKS.map((h) => (
                    <button
                      key={h.name}
                      type="button"
                      onClick={() => {
                        setHook(h);
                        setShowHooks(false);
                      }}
                      className={`block w-full px-2.5 py-2 rounded-xs text-left ${
                        hook.name === h.name ? "bg-chip" : "hover:bg-row-hover"
                      }`}
                    >
                      <div className="text-[13px] font-medium">{h.name}</div>
                      <div className="text-[11px] text-text-dim">{h.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-mute tracking-[0.08em] mb-1.5 font-semibold">
              PRICE RANGE
            </div>
            <div className="flex gap-1 bg-bg-elev p-0.5 rounded-md border border-border-soft">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRange(r);
                  }}
                  className={`flex-1 py-2 text-[12px] rounded-xs font-medium ${
                    range === r ? "bg-chip text-text" : "bg-transparent text-text-dim"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fee Tier + Hook Benefit */}
        <div className="flex justify-between items-center mt-4 text-[13px]">
          <span className="text-text-dim">Fee Tier</span>
          <span className="font-mono text-text">{FEE_TIER_LABELS[ctx.fee]}</span>
        </div>
        <div className="flex justify-between items-center mt-2 text-[13px]">
          <span className="text-text-dim">Hook Benefit</span>
          <span className="text-green">{hook.desc}</span>
        </div>

        {/* CTA */}
        <Button
          variant="primary"
          size="lg"
          disabled={!ready || add.state.status !== "idle"}
          onClick={() => {
            void onSubmit();
          }}
          className="w-full mt-5"
        >
          {ready ? addCtaLabel(add.state) : "Review & Sign Position"}
        </Button>

        {add.state.approvalTx && (
          <a
            href={`${BASESCAN_TX}${add.state.approvalTx}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-text-dim hover:text-accent inline-flex items-center gap-1 justify-center mt-3 w-full"
          >
            Approval tx <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {add.state.txHash && (
          <a
            href={`${BASESCAN_TX}${add.state.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:text-accent-2 inline-flex items-center gap-1 justify-center mt-3 w-full"
          >
            View on BaseScan <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {add.state.status === "error" && add.state.error && (
          <p className="text-xs text-red text-center mt-3">{add.state.error.message}</p>
        )}
      </div>
    </>
  );
}

function feeTierToPct(label: string): string {
  const m = /([\d.]+)/.exec(label);
  if (!m) return "0.00%";
  return `${m[1]}%`;
}

interface TokenInputCardProps {
  label: string;
  sym: TokenSymbol;
  amount: string;
  onAmountChange: (s: string) => void;
  onSymbolChange: (s: TokenSymbol) => void;
  disabledSymbol: TokenSymbol;
}

function TokenInputCard({
  label,
  sym,
  amount,
  onAmountChange,
  onSymbolChange,
  disabledSymbol,
}: TokenInputCardProps) {
  return (
    <div className="bg-bg-elev border border-border-soft rounded-md px-3.5 py-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-text-dim">{label}</span>
        <span className="text-text-mute">Balance: 0.00</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            onAmountChange(e.target.value);
          }}
          placeholder="0.0"
          className="flex-1 min-w-0 bg-transparent border-none outline-none p-0 font-mono text-[24px] tracking-[-0.01em] text-text"
        />
        <TokenSelector value={sym} onChange={onSymbolChange} disabledSymbol={disabledSymbol} />
      </div>
      <div className="text-[11px] text-text-mute mt-0.5">≈ $0.00</div>
      <div className="border-t border-dashed border-border-soft mt-2.5 pt-2 flex justify-between text-[11px] text-text-dim">
        <span>Current Price</span>
        <span className="font-mono">$—</span>
      </div>
    </div>
  );
}

const SPARK_POINTS = Array.from({ length: 28 }, (_, i) =>
  55 + Math.sin(i * 0.9) * 6 + Math.cos(i * 1.4) * 3,
);

function Sparkline() {
  const path = useMemo(() => {
    const w = 480;
    const h = 130;
    const pad = 14;
    const mn = Math.min(...SPARK_POINTS);
    const mx = Math.max(...SPARK_POINTS);
    const sx = (i: number) => pad + (i / (SPARK_POINTS.length - 1)) * (w - pad * 2);
    const sy = (v: number) => pad + (1 - (v - mn) / (mx - mn + 0.001)) * (h - pad * 2);
    const line = SPARK_POINTS.map((v, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(
      " ",
    );
    const area = `${line} L${sx(SPARK_POINTS.length - 1)},${h - pad} L${sx(0)},${h - pad} Z`;
    return { line, area };
  }, []);
  return (
    <svg viewBox="0 0 480 130" width="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id="alFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--amber)" stopOpacity=".25" />
          <stop offset="1" stopColor="var(--amber)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill="url(#alFill)" />
      <path d={path.line} fill="none" stroke="var(--amber)" strokeWidth="1.5" />
    </svg>
  );
}

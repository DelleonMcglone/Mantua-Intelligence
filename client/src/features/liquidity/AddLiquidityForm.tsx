import { useMemo, useRef, useState, useEffect } from "react";
import { ArrowLeft, ArrowUp, ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { PanelSubHeader } from "@/components/shell/PanelSubHeader.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useConfirmedAction } from "@/hooks/use-confirmed-action.tsx";
import { BASESCAN_TX, type TokenSymbol } from "@/lib/tokens.ts";
import { TokenSelector } from "@/features/swap/TokenSelector.tsx";
import { DEFAULT_FEE_TIER_FOR_PAIR, FEE_TIER_LABELS, type FeeTier } from "./fee-tiers.ts";
import { FeeTierPicker } from "./FeeTierPicker.tsx";
import { TokenPairIcon } from "./TokenPairIcon.tsx";
import { isStable, safeParse } from "./create-helpers.ts";
import { addCtaLabel } from "./add-helpers.ts";
import { useAddLiquidity } from "./use-add-liquidity.ts";
import type { HookName } from "./use-create-pool.ts";
import {
  HOOK_DESCRIPTIONS,
  HOOK_LABELS,
  hookCompatibilityError,
  recommendedHookForPair,
} from "./hook-recommendations.ts";
import { useTokenPrices } from "./use-token-prices.ts";

export interface PoolKeyContext {
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  fee: FeeTier;
  /** Hook bound to the pool. Required for hook-managed pools so the
   *  reconstructed PoolKey matches on-chain (Stable Protection / Dynamic
   *  Fee pools have `key.fee = DYNAMIC_FEE_FLAG`). Null = no-hook pool. */
  hook?: HookName | null;
  /** Set by the pool-create flow with the just-initialized price.
   *  Omitted when entering from PoolDetailPage — server reads slot0. */
  sqrtPriceX96?: string;
  /** True when the form was opened against a known existing pool —
   *  locks the pair / fee / hook controls so the user can't drift away
   *  from the pool they're trying to deposit into. */
  locked?: boolean;
}

interface Props {
  /** Initial pair / fee / hook to pre-fill. Omit to start from defaults
   *  (USDC/EURC + 0.01% + Stable Protection) — the form will then act
   *  as a unified "create or add" surface. */
  ctx?: PoolKeyContext;
  onBack: () => void;
  onClose?: () => void;
}

const HOOK_OPTIONS: { value: HookName | "none"; name: string; desc: string }[] = [
  { value: "none", name: "No Hook", desc: "Standard execution" },
  { value: "stable-protection", name: HOOK_LABELS["stable-protection"], desc: HOOK_DESCRIPTIONS["stable-protection"] },
  { value: "dynamic-fee", name: HOOK_LABELS["dynamic-fee"], desc: HOOK_DESCRIPTIONS["dynamic-fee"] },
];

const DEFAULT_TOKEN_A: TokenSymbol = "USDC";
const DEFAULT_TOKEN_B: TokenSymbol = "EURC";

function hookFromCtx(h: HookName | null | undefined): HookName | "none" {
  return h ?? "none";
}

const HOOK_REQUIRES_DYNAMIC_FEE: Record<HookName, boolean> = {
  "stable-protection": true,
  "dynamic-fee": true,
};

function formatMirror(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return value.toFixed(6).replace(/\.?0+$/, "");
}

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
  const locked = ctx?.locked === true;
  const [tokenA, setTokenA] = useState<TokenSymbol>(ctx?.tokenA ?? DEFAULT_TOKEN_A);
  const [tokenB, setTokenB] = useState<TokenSymbol>(ctx?.tokenB ?? DEFAULT_TOKEN_B);
  const [fee, setFee] = useState<FeeTier>(
    ctx?.fee ??
      DEFAULT_FEE_TIER_FOR_PAIR(
        isStable(ctx?.tokenA ?? DEFAULT_TOKEN_A),
        isStable(ctx?.tokenB ?? DEFAULT_TOKEN_B),
      ),
  );
  const [hook, setHook] = useState<HookName | "none">(() => {
    if (ctx?.hook !== undefined) return hookFromCtx(ctx.hook);
    return recommendedHookForPair(DEFAULT_TOKEN_A, DEFAULT_TOKEN_B) ?? "none";
  });
  const [hookTouched, setHookTouched] = useState(false);
  const [amountA, setAmountA] = useState("0.0");
  const [amountB, setAmountB] = useState("0.0");
  const [chartRange, setChartRange] = useState<ChartRange>("7D");
  const [chartTab, setChartTab] = useState<"volume" | "tvl">("volume");
  const [showHooks, setShowHooks] = useState(false);
  const [range, setRange] = useState<RangeOption>("Full");
  const hookRef = useRef<HTMLDivElement | null>(null);
  const confirm = useConfirmedAction();
  const add = useAddLiquidity();

  // Auto-suggest a hook when the user changes the pair, but only until
  // they explicitly pick one — same behavior as the (now-removed)
  // dedicated PoolCreateForm.
  const recommended = useMemo(() => recommendedHookForPair(tokenA, tokenB), [tokenA, tokenB]);
  useEffect(() => {
    if (locked || hookTouched) return;
    setHook(recommended ?? "none");
  }, [recommended, locked, hookTouched]);

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

  // Mirror Token A ↔ Token B at the live USD price ratio so users
  // type once. Stable-stable pairs fall back to 1:1; pairs with no
  // available ratio (CoinGecko 4xx, etc.) leave the other side alone.
  const tokenPrices = useTokenPrices(useMemo(() => [tokenA, tokenB], [tokenA, tokenB]));
  const priceRatioAtoB = useMemo(() => {
    const pa = tokenPrices.prices[tokenA];
    const pb = tokenPrices.prices[tokenB];
    if (pa && pb && pa > 0 && pb > 0) return pa / pb;
    if (isStable(tokenA) && isStable(tokenB)) return 1;
    return null;
  }, [tokenPrices.prices, tokenA, tokenB]);

  function onAmountAChange(value: string) {
    setAmountA(value);
    if (priceRatioAtoB === null) return;
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return;
    setAmountB(formatMirror(num * priceRatioAtoB));
  }
  function onAmountBChange(value: string) {
    setAmountB(value);
    if (priceRatioAtoB === null) return;
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return;
    setAmountA(formatMirror(num / priceRatioAtoB));
  }

  const amountARaw = safeParse(tokenA, amountA);
  const amountBRaw = safeParse(tokenB, amountB);
  const hookName: HookName | null = hook === "none" ? null : hook;
  const hookIncompatible = hookCompatibilityError(tokenA, tokenB, hookName);
  const ready =
    tokenA !== tokenB && amountARaw !== "0" && amountBRaw !== "0" && hookIncompatible === null;
  const hookSummary = hook === "none" ? "No Hook" : HOOK_LABELS[hook];
  const hookDesc = hook === "none" ? "Standard execution" : HOOK_DESCRIPTIONS[hook];

  async function onSubmit() {
    if (!ready) return;
    const ok = await confirm({
      title: `Create / add liquidity · ${tokenA}/${tokenB} · ${hookSummary}`,
      description: `${amountA} ${tokenA} + ${amountB} ${tokenB} · fee ${FEE_TIER_LABELS[fee]} · range ${range}`,
      confirmLabel: "Sign in wallet",
    });
    if (!ok) return;
    await add.execute({
      tokenA,
      tokenB,
      fee,
      hook: hookName,
      amountARaw,
      amountBRaw,
      ...(ctx?.sqrtPriceX96 ? { sqrtPriceX96: ctx.sqrtPriceX96 } : {}),
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
          <TokenPairIcon a={tokenA} b={tokenB} size={22} />
          <div className="text-[14px] font-semibold">
            {tokenA} / {tokenB}
          </div>
          <span className="px-1.5 py-px rounded-[6px] text-[10px] font-medium tracking-[0.04em] bg-chip text-text-mute border border-border-soft uppercase">
            {hookSummary}
          </span>
        </div>

        {/* Mini stats row */}
        <div className="flex gap-3.5 text-[12px] text-text-dim mb-3.5">
          <span className="text-green inline-flex items-center gap-0.5">
            ↗ {feeTierToPct(FEE_TIER_LABELS[fee])} Fee
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
            {tokenA}/{tokenB} Price
          </div>
          <Sparkline />
        </div>

        {/* Token inputs + flip button */}
        <div
          className="grid items-stretch mt-4 gap-2"
          style={{ gridTemplateColumns: "1fr auto 1fr" }}
        >
          <TokenInputCard
            label={tokenA}
            sym={tokenA}
            amount={amountA}
            onAmountChange={onAmountAChange}
            onSymbolChange={locked ? () => undefined : setTokenA}
            disabledSymbol={tokenB}
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
            label={tokenB}
            sym={tokenB}
            amount={amountB}
            onAmountChange={onAmountBChange}
            onSymbolChange={locked ? () => undefined : setTokenB}
            disabledSymbol={tokenA}
          />
        </div>

        {/* Fee tier picker — only when not locked to an existing pool */}
        {!locked && (
          <div className="mt-4">
            <div className="text-[10px] text-text-mute tracking-[0.08em] mb-1.5 font-semibold">
              FEE TIER
            </div>
            <FeeTierPicker value={fee} onChange={setFee} />
            {hookName && HOOK_REQUIRES_DYNAMIC_FEE[hookName] && (
              <p className="text-[11px] text-text-mute mt-1.5">
                {hookSummary} sets the fee dynamically per swap; your tier
                selection determines tick spacing only.
              </p>
            )}
          </div>
        )}

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
                  if (locked) return;
                  setShowHooks((v) => !v);
                }}
                disabled={locked}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-bg-elev border border-border-soft rounded-md cursor-pointer text-left disabled:cursor-not-allowed"
              >
                <ArrowUp className="h-3.5 w-3.5 text-text-dim" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium">{hookSummary}</div>
                  <div className="text-[11px] text-text-dim">{hookDesc}</div>
                </div>
                {!locked && <ChevronDown className="h-3.5 w-3.5 text-text-dim" />}
              </button>
              {showHooks && !locked && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-panel-solid border border-border rounded-md p-1 shadow-xl">
                  {HOOK_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setHook(opt.value);
                        setHookTouched(true);
                        setShowHooks(false);
                      }}
                      className={`block w-full px-2.5 py-2 rounded-xs text-left ${
                        hook === opt.value ? "bg-chip" : "hover:bg-row-hover"
                      }`}
                    >
                      <div className="text-[13px] font-medium">{opt.name}</div>
                      <div className="text-[11px] text-text-dim">{opt.desc}</div>
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
          <span className="font-mono text-text">{FEE_TIER_LABELS[fee]}</span>
        </div>
        <div className="flex justify-between items-center mt-2 text-[13px]">
          <span className="text-text-dim">Hook Benefit</span>
          <span className="text-green">{hookDesc}</span>
        </div>

        {hookIncompatible && (
          <p className="text-xs text-amber text-center mt-3">{hookIncompatible}</p>
        )}

        {/* CTA */}
        <Button
          variant="primary"
          size="lg"
          disabled={
            !ready ||
            add.state.status === "creating-pool" ||
            add.state.status === "pool-pending" ||
            add.state.status === "preparing" ||
            add.state.status === "approving" ||
            add.state.status === "signing" ||
            add.state.status === "pending" ||
            add.state.status === "success"
          }
          onClick={() => {
            void onSubmit();
          }}
          className="w-full mt-5"
        >
          {hookIncompatible
            ? "Hook unavailable for this pair"
            : ready
              ? addCtaLabel(add.state)
              : "Enter amounts"}
        </Button>

        {add.state.poolInitTx && (
          <a
            href={`${BASESCAN_TX}${add.state.poolInitTx}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-text-dim hover:text-accent inline-flex items-center gap-1 justify-center mt-3 w-full"
          >
            Pool init tx <ExternalLink className="h-3 w-3" />
          </a>
        )}
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
        {add.state.status === "success" && (
          <button
            type="button"
            onClick={() => {
              add.reset();
              setAmountA("0.0");
              setAmountB("0.0");
            }}
            className="block mx-auto mt-3 px-3 py-1.5 rounded-xs border border-border bg-transparent text-text-dim text-[12px] cursor-pointer hover:text-text hover:border-text-mute transition-colors"
          >
            Add more liquidity
          </button>
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

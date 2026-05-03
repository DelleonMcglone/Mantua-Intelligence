import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { PanelSubHeader } from "@/components/shell/PanelSubHeader.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useConfirmedAction } from "@/hooks/use-confirmed-action.tsx";
import { BASESCAN_TX, type TokenSymbol } from "@/lib/tokens.ts";
import {
  DEFAULT_FEE_TIER_FOR_PAIR,
  FEE_TIER_LABELS,
  type FeeTier,
} from "./fee-tiers.ts";
import { FeeTierPicker } from "./FeeTierPicker.tsx";
import { PairCell } from "./PairCell.tsx";
import { ctaLabel, isStable, ratioLabel, safeParse } from "./create-helpers.ts";
import { useCreatePool, type HookName } from "./use-create-pool.ts";
import {
  HOOK_DESCRIPTIONS,
  HOOK_LABELS,
  recommendedHookForPair,
} from "./hook-recommendations.ts";

interface Props {
  onBack: () => void;
  onAddLiquidity: (ctx: {
    tokenA: TokenSymbol;
    tokenB: TokenSymbol;
    fee: FeeTier;
    sqrtPriceX96: string;
  }) => void;
  onClose?: () => void;
}

const HOOK_OPTIONS: (HookName | "none")[] = [
  "none",
  "stable-protection",
  "dynamic-fee",
  "rwa-gate",
  "async-limit-order",
];

export function PoolCreateForm({ onBack, onAddLiquidity, onClose }: Props) {
  const [tokenA, setTokenA] = useState<TokenSymbol>("USDC");
  const [tokenB, setTokenB] = useState<TokenSymbol>("EURC");
  const [fee, setFee] = useState<FeeTier>(() =>
    DEFAULT_FEE_TIER_FOR_PAIR(isStable("USDC"), isStable("EURC")),
  );
  const [amountA, setAmountA] = useState("1");
  const [amountB, setAmountB] = useState("1");
  const [hook, setHook] = useState<HookName | "none">(
    () => recommendedHookForPair("USDC", "EURC") ?? "none",
  );
  const [hookTouched, setHookTouched] = useState(false);
  const [showHooks, setShowHooks] = useState(false);
  const hookRef = useRef<HTMLDivElement | null>(null);

  const confirm = useConfirmedAction();
  const create = useCreatePool();

  // Auto-suggest hook when the pair changes — but stop overriding once
  // the user has explicitly picked a hook (so re-flipping the pair
  // doesn't undo their choice).
  const recommended = useMemo(() => recommendedHookForPair(tokenA, tokenB), [tokenA, tokenB]);
  useEffect(() => {
    if (hookTouched) return;
    setHook(recommended ?? "none");
  }, [recommended, hookTouched]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!hookRef.current) return;
      if (!hookRef.current.contains(e.target as Node)) setShowHooks(false);
    }
    if (showHooks) document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [showHooks]);

  const amountARaw = safeParse(tokenA, amountA);
  const amountBRaw = safeParse(tokenB, amountB);
  const ready = tokenA !== tokenB && amountARaw !== "0" && amountBRaw !== "0";

  async function onSubmit() {
    if (!ready) return;
    const hookSummary = hook === "none" ? "no hook" : HOOK_LABELS[hook];
    const ok = await confirm({
      title: `Create ${tokenA}/${tokenB} pool · ${hookSummary}`,
      description: `Fee tier ${FEE_TIER_LABELS[fee]} · initial price 1 ${tokenA} = ${ratioLabel(amountA, amountB)} ${tokenB}`,
      confirmLabel: "Initialize pool",
    });
    if (!ok) return;
    await create.execute({
      tokenA,
      tokenB,
      fee,
      hook: hook === "none" ? null : hook,
      initialAmount0Raw: amountARaw,
      initialAmount1Raw: amountBRaw,
    });
  }

  const hookLabel = hook === "none" ? "No Hook" : HOOK_LABELS[hook];
  const hookDesc = hook === "none" ? "Standard execution" : HOOK_DESCRIPTIONS[hook];
  const showRecommendationHint =
    recommended !== null && hook !== recommended && !hookTouched;

  return (
    <>
      <PanelHeader />
      <PanelSubHeader
        title="Create pool"
        onBack={onBack}
        {...(onClose ? { onClose } : {})}
      />

      <div className="flex-1 overflow-auto px-5 pt-2 pb-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <PairCell
            label="Token A"
            symbol={tokenA}
            onSymbolChange={setTokenA}
            disabledSymbol={tokenB}
            amount={amountA}
            onAmountChange={setAmountA}
          />
          <PairCell
            label="Token B"
            symbol={tokenB}
            onSymbolChange={setTokenB}
            disabledSymbol={tokenA}
            amount={amountB}
            onAmountChange={setAmountB}
          />
        </div>

        <div>
          <p className="text-xs text-text-dim mb-2 uppercase tracking-wider">Fee tier</p>
          <FeeTierPicker value={fee} onChange={setFee} />
        </div>

        <div>
          <p className="text-[10px] text-text-mute tracking-[0.08em] mb-1.5 font-semibold">
            LIQUIDITY HOOK
          </p>
          <div className="relative" ref={hookRef}>
            <button
              type="button"
              onClick={() => {
                setShowHooks((v) => !v);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-bg-elev border border-border-soft rounded-md cursor-pointer text-left"
            >
              <div className="flex-1">
                <div className="text-[13px] font-medium">{hookLabel}</div>
                <div className="text-[11px] text-text-dim">{hookDesc}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-text-dim" />
            </button>
            {showHooks && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-panel-solid border border-border rounded-md p-1 shadow-xl">
                {HOOK_OPTIONS.map((opt) => {
                  const selected = hook === opt;
                  const label = opt === "none" ? "No Hook" : HOOK_LABELS[opt];
                  const desc = opt === "none" ? "Standard execution" : HOOK_DESCRIPTIONS[opt];
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setHook(opt);
                        setHookTouched(true);
                        setShowHooks(false);
                      }}
                      className={`block w-full px-2.5 py-2 rounded-xs text-left ${
                        selected ? "bg-chip" : "hover:bg-row-hover"
                      }`}
                    >
                      <div className="text-[13px] font-medium">{label}</div>
                      <div className="text-[11px] text-text-dim">{desc}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {showRecommendationHint && recommended && (
            <p className="text-[11px] text-text-mute mt-1.5">
              Recommended for this pair:{" "}
              <button
                type="button"
                onClick={() => {
                  setHook(recommended);
                  setHookTouched(true);
                }}
                className="text-accent underline"
              >
                {HOOK_LABELS[recommended]}
              </button>
            </p>
          )}
        </div>

        <div className="text-xs text-text-mute leading-relaxed">
          Initial price: 1 {tokenA} = {ratioLabel(amountA, amountB)} {tokenB}. Tokens
          auto-sort to v4 canonical order; the active hook is encoded into the PoolKey.
        </div>

        <Button
          variant="primary"
          size="lg"
          disabled={!ready || create.state.status !== "idle"}
          onClick={() => {
            void onSubmit();
          }}
        >
          {ctaLabel(create.state.status, !ready)}
        </Button>

        {create.state.txHash && (
          <a
            href={`${BASESCAN_TX}${create.state.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:text-accent-2 inline-flex items-center gap-1 justify-center"
          >
            View on BaseScan <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {create.state.status === "success" && create.state.poolKey && (
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              onAddLiquidity({
                tokenA,
                tokenB,
                fee,
                sqrtPriceX96: create.state.poolKey?.sqrtPriceX96 ?? "0",
              });
            }}
          >
            Add liquidity to this pool →
          </Button>
        )}
        {create.state.status === "error" && create.state.error && (
          <p className="text-xs text-red text-center">{create.state.error.message}</p>
        )}
      </div>
    </>
  );
}

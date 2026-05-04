import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { PanelSubHeader } from "@/components/shell/PanelSubHeader.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useConfirmedAction } from "@/hooks/use-confirmed-action.tsx";
import { TOKENS, type TokenSymbol } from "@/lib/tokens.ts";
import { usePortfolio } from "@/features/portfolio/use-portfolio.ts";
import {
  DEFAULT_FEE_TIER_FOR_PAIR,
  FEE_TIER_LABELS,
  type FeeTier,
} from "@/features/liquidity/fee-tiers.ts";
import { FeeTierPicker } from "@/features/liquidity/FeeTierPicker.tsx";
import { isStable } from "@/features/liquidity/create-helpers.ts";
import { recommendedHookForPair, HOOK_LABELS } from "@/features/liquidity/hook-recommendations.ts";
import type { HookName } from "@/features/liquidity/use-create-pool.ts";
import { TokenSelector } from "./TokenSelector.tsx";
import { formatTokenAmount, parseTokenAmount } from "./format.ts";
import { useTestnetQuote, useTestnetSwap } from "./use-testnet-swap.ts";
import { BASE_SCAN_TX, DEFAULT_SLIPPAGE_BPS } from "./constants.ts";

interface Props {
  onClose?: () => void;
}

const HOOK_OPTIONS: { value: HookName | "none"; label: string }[] = [
  { value: "none", label: "No Hook" },
  { value: "stable-protection", label: HOOK_LABELS["stable-protection"] },
  { value: "dynamic-fee", label: HOOK_LABELS["dynamic-fee"] },
  { value: "rwa-gate", label: HOOK_LABELS["rwa-gate"] },
  { value: "async-limit-order", label: HOOK_LABELS["async-limit-order"] },
];

function safeParse(symbol: TokenSymbol, input: string): string {
  if (!input || input === ".") return "0";
  try {
    return parseTokenAmount(symbol, input).toString();
  } catch {
    return "0";
  }
}

function ctaLabel(status: ReturnType<typeof useTestnetSwap>["state"]["status"]): string {
  switch (status) {
    case "quoting":
      return "Building swap…";
    case "approving":
      return "Approving in wallet…";
    case "signing":
      return "Sign swap in wallet…";
    case "pending":
      return "Confirming on-chain…";
    case "success":
      return "Swap complete";
    case "error":
      return "Try again";
    default:
      return "Sign & swap";
  }
}

/**
 * Testnet-only swap panel — talks to `/api/v4/quote` (V4Quoter) and
 * `/api/v4/swap/calldata` (PoolSwapTest helper). Mainnet keeps the
 * production `SwapPanel` which uses Uniswap's Trading API. Lives as a
 * sibling component so the production swap path stays untouched.
 *
 * UX delta vs mainnet:
 * - Explicit fee-tier picker, since v4 swaps go against a specific
 *   PoolKey. Defaults from `DEFAULT_FEE_TIER_FOR_PAIR`.
 * - Hook selector that mirrors the create-pool form. Routing picks
 *   the pool whose `(currency0, currency1, fee, tickSpacing, hooks)`
 *   matches the user's selection.
 */
export function TestnetSwapPanel({ onClose }: Props) {
  const [tokenIn, setTokenIn] = useState<TokenSymbol>("USDC");
  const [tokenOut, setTokenOut] = useState<TokenSymbol>("EURC");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState<FeeTier>(() =>
    DEFAULT_FEE_TIER_FOR_PAIR(isStable("USDC"), isStable("EURC")),
  );
  const [hook, setHook] = useState<HookName | "none">(
    () => recommendedHookForPair("USDC", "EURC") ?? "none",
  );
  const [slippageBps] = useState(DEFAULT_SLIPPAGE_BPS);

  const confirm = useConfirmedAction();
  const swap = useTestnetSwap();
  const portfolio = usePortfolio();

  const balanceIn = useMemo(() => {
    const b = portfolio.balances.find((x) => x.symbol === tokenIn);
    return b ? BigInt(b.balanceRaw) : 0n;
  }, [portfolio.balances, tokenIn]);
  const balanceInDisplay = useMemo(
    () => formatTokenAmount(tokenIn, balanceIn),
    [tokenIn, balanceIn],
  );

  function applyPercent(pct: number) {
    if (balanceIn === 0n) return;
    let raw = (balanceIn * BigInt(pct)) / 100n;
    if (TOKENS[tokenIn].native && pct === 100) {
      const buffer = 200_000_000_000_000n;
      raw = raw > buffer ? raw - buffer : 0n;
    }
    setAmount(formatTokenAmount(tokenIn, raw));
  }

  const amountInRaw = safeParse(tokenIn, amount);
  const quote = useTestnetQuote({
    tokenIn,
    tokenOut,
    fee,
    hook: hook === "none" ? null : hook,
    amountInRaw,
    enabled: amountInRaw !== "0",
  });

  const expectedOut = quote.data
    ? formatTokenAmount(tokenOut, quote.data.amountOut)
    : "";

  function selectTokenIn(sym: TokenSymbol) {
    if (sym === tokenOut) setTokenOut(tokenIn);
    setTokenIn(sym);
  }
  function selectTokenOut(sym: TokenSymbol) {
    if (sym === tokenIn) setTokenIn(tokenOut);
    setTokenOut(sym);
  }

  function flip() {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
  }

  async function onSwap() {
    if (!quote.data) return;
    const ok = await confirm({
      title: `Swap ${amount} ${tokenIn} → ${expectedOut} ${tokenOut}`,
      description: `${FEE_TIER_LABELS[fee]} · ${hook === "none" ? "No Hook" : HOOK_LABELS[hook]} · ${(slippageBps / 100).toFixed(2)}% slippage`,
      confirmLabel: "Sign & swap",
    });
    if (!ok) return;
    await swap.execute({
      tokenIn,
      tokenOut,
      fee,
      hook: hook === "none" ? null : hook,
      amountInRaw,
      slippageBps,
    });
  }

  const amountEntered = amountInRaw !== "0" && parseFloat(amount) > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PanelHeader />
      <PanelSubHeader title="Swap" {...(onClose ? { onClose } : {})} />

      <div className="flex-1 overflow-auto px-5 pt-2 pb-5">
        {/* Sell card */}
        <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3.5">
          <div className="flex items-center justify-between text-[13px]">
            <span>Sell</span>
            <span className="text-text-dim">
              Balance: {balanceInDisplay} {tokenIn}
            </span>
          </div>
          <div className="flex gap-2 mt-2.5">
            {([
              { label: "25%", pct: 25 },
              { label: "50%", pct: 50 },
              { label: "75%", pct: 75 },
              { label: "Max", pct: 100 },
            ] as const).map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  applyPercent(p.pct);
                }}
                disabled={balanceIn === 0n}
                className="flex-1 py-[7px] border border-border bg-transparent text-text-dim rounded-xs text-[12px] cursor-pointer font-medium hover:text-text hover:border-text-mute transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3.5">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
              }}
              placeholder="0.00"
              className={`flex-1 min-w-0 bg-transparent border-none outline-none p-0 font-mono text-[38px] font-light tracking-[-0.03em] ${
                amountEntered ? "text-text" : "text-text-mute"
              }`}
            />
            <TokenSelector value={tokenIn} onChange={selectTokenIn} />
          </div>
        </div>

        <div className="flex justify-center -my-2.5 relative z-10">
          <button
            type="button"
            onClick={flip}
            aria-label="Flip tokens"
            className="w-[34px] h-[34px] rounded-full bg-bg-elev border border-border flex items-center justify-center cursor-pointer text-green hover:border-green/60 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 20V4M7 4l-4 4M7 4l4 4" />
              <path d="M17 4v16M17 20l-4-4M17 20l4-4" />
            </svg>
          </button>
        </div>

        {/* Buy card */}
        <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3.5 mt-3">
          <div className="flex items-center justify-between text-[13px]">
            <span>Buy</span>
            <span className="text-text-dim">expected</span>
          </div>
          <div className="flex items-center justify-between mt-3.5">
            <input
              value={expectedOut}
              readOnly
              placeholder="0.00"
              className="flex-1 min-w-0 bg-transparent border-none outline-none p-0 font-mono text-[38px] font-light tracking-[-0.03em] text-text-mute"
            />
            <TokenSelector value={tokenOut} onChange={selectTokenOut} />
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[10px] text-text-mute tracking-[0.08em] mb-1.5 font-semibold">
            FEE TIER
          </p>
          <FeeTierPicker value={fee} onChange={setFee} />
        </div>

        <div className="mt-4">
          <p className="text-[10px] text-text-mute tracking-[0.08em] mb-1.5 font-semibold">
            LIQUIDITY HOOK
          </p>
          <select
            value={hook}
            onChange={(e) => {
              setHook(e.target.value as HookName | "none");
            }}
            className="w-full px-3 py-2.5 bg-bg-elev border border-border-soft rounded-md text-[13px] text-text"
          >
            {HOOK_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {quote.loading && (
          <p className="text-xs text-text-dim text-center mt-3">Fetching quote…</p>
        )}
        {quote.error && (
          <p className="text-xs text-red text-center mt-3">{quote.error.message}</p>
        )}

        <Button
          variant="primary"
          size="lg"
          disabled={
            !quote.data ||
            !amountEntered ||
            swap.state.status === "quoting" ||
            swap.state.status === "approving" ||
            swap.state.status === "signing" ||
            swap.state.status === "pending" ||
            swap.state.status === "success"
          }
          onClick={() => {
            void onSwap();
          }}
          className="w-full mt-5"
        >
          {amountEntered ? ctaLabel(swap.state.status) : "Enter amount"}
        </Button>

        {swap.state.message && swap.state.status !== "idle" && swap.state.status !== "error" && (
          <p className="text-xs text-text-mute text-center mt-2">{swap.state.message}</p>
        )}

        {swap.state.approvalTx && (
          <a
            href={`${BASE_SCAN_TX}${swap.state.approvalTx}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-text-dim hover:text-accent inline-flex items-center gap-1 justify-center mt-3 w-full"
          >
            Approval tx <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {swap.state.txHash && (
          <a
            href={`${BASE_SCAN_TX}${swap.state.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:text-accent-2 inline-flex items-center gap-1 justify-center mt-3 w-full"
          >
            View on BaseScan <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {swap.state.status === "success" && (
          <button
            type="button"
            onClick={() => {
              swap.reset();
              setAmount("");
            }}
            className="block mx-auto mt-3 px-3 py-1.5 rounded-xs border border-border bg-transparent text-text-dim text-[12px] cursor-pointer hover:text-text hover:border-text-mute transition-colors"
          >
            Make another swap
          </button>
        )}
        {swap.state.status === "error" && swap.state.error && (
          <p className="text-xs text-red text-center mt-3">{swap.state.error.message}</p>
        )}
      </div>
    </div>
  );
}

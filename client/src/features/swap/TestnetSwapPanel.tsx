import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { PanelSubHeader } from "@/components/shell/PanelSubHeader.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useConfirmedAction } from "@/hooks/use-confirmed-action.tsx";
import { useCurrentChainId } from "@/lib/chain-context.tsx";
import { getUserFacingTokenSymbols, TOKENS, type TokenSymbol } from "@/lib/tokens.ts";
import { usePortfolio } from "@/features/portfolio/use-portfolio.ts";
import {
  FEE_TIER_LABELS,
  recommendedFeeTier,
  type FeeTier,
} from "@/features/liquidity/fee-tiers.ts";
import { FeeTierPicker } from "@/features/liquidity/FeeTierPicker.tsx";
import { isStable } from "@/features/liquidity/create-helpers.ts";
import {
  HOOK_LABELS,
  hookCompatibilityError,
  recommendedHookForPair,
} from "@/features/liquidity/hook-recommendations.ts";
import type { HookName } from "@/features/liquidity/use-create-pool.ts";
import { TokenSelector } from "./TokenSelector.tsx";
import { formatTokenAmount, parseTokenAmount } from "./format.ts";
import { useTestnetMaxInput, useTestnetQuote, useTestnetSwap } from "./use-testnet-swap.ts";
import { EXPLORER_TX_URL, DEFAULT_SLIPPAGE_BPS } from "./constants.ts";

interface Props {
  onClose?: () => void;
  initialTokenIn?: TokenSymbol;
  initialTokenOut?: TokenSymbol;
  /** Pre-select a hook / pre-fill the amount from a chat command. */
  initialHook?: HookName;
  initialAmount?: string;
}

const HOOK_OPTIONS: { value: HookName | "none"; label: string }[] = [
  { value: "none", label: "No Hook" },
  { value: "stable-protection", label: HOOK_LABELS["stable-protection"] },
  { value: "dynamic-fee", label: HOOK_LABELS["dynamic-fee"] },
  { value: "rwa-gate", label: HOOK_LABELS["rwa-gate"] },
  { value: "alo", label: HOOK_LABELS.alo },
];

function safeParse(symbol: TokenSymbol, input: string): string {
  if (!input || input === ".") return "0";
  try {
    return parseTokenAmount(symbol, input).toString();
  } catch {
    return "0";
  }
}

/**
 * Turn a decoded on-chain revert (e.g. `CircuitBreakerTripped(4, …)`)
 * into a sentence a user can act on. Falls back to the raw decoded
 * string when no specific match is found so we never hide info.
 */
function humanizeRevertReason(decoded: string): string {
  if (/^CircuitBreakerTripped/.test(decoded)) {
    return "Stable Protection hook detected a depeg and tripped its circuit breaker. Try again later or use a different hook.";
  }
  if (/^PoolNotConfigured/.test(decoded)) {
    return "This Dynamic Fee pool hasn't been configured by the hook owner yet — swaps stay disabled until a one-time owner setup (configurePool) runs. Use a different hook for now.";
  }
  if (/^NotWhitelisted/.test(decoded)) {
    return "RWA Gate is a permissioned pool — your address isn't allowlisted in its compliance registry yet, so swaps are blocked. The hook owner must whitelist the account first.";
  }
  if (/Stable Protection is only available on the USDC\/EURC pair/.test(decoded)) {
    return "Stable Protection works only on USDC/EURC. Pick that pair or choose a different hook.";
  }
  if (/^Error:/.test(decoded)) return decoded.replace(/^Error:\s*/, "");
  // Generic hook rejection we couldn't decode to a named error (e.g. the
  // ALO async-limit-order hook, which doesn't fill a plain market swap).
  // Surface a readable message instead of the raw WrappedError(0x…) hex.
  if (/^WrappedError\(/.test(decoded)) {
    return "The hook rejected this swap. The pool may need a one-time owner setup, or this hook doesn't support a direct market swap for this pair — try a different hook.";
  }
  return decoded;
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
export function TestnetSwapPanel({
  onClose,
  initialTokenIn,
  initialTokenOut,
  initialHook,
  initialAmount,
}: Props) {
  const seedIn: TokenSymbol = initialTokenIn ?? "USDC";
  const seedOut: TokenSymbol = initialTokenOut ?? "EURC";
  const seedHook: HookName | "none" =
    initialHook ?? recommendedHookForPair(seedIn, seedOut) ?? "none";
  const [tokenIn, setTokenIn] = useState<TokenSymbol>(seedIn);
  const [tokenOut, setTokenOut] = useState<TokenSymbol>(seedOut);
  const [amount, setAmount] = useState(initialAmount ?? "");
  const [fee, setFee] = useState<FeeTier>(() =>
    recommendedFeeTier(seedHook === "none" ? null : seedHook, isStable(seedIn), isStable(seedOut)),
  );
  const [hook, setHook] = useState<HookName | "none">(() => seedHook);
  const [slippageBps] = useState(DEFAULT_SLIPPAGE_BPS);

  const confirm = useConfirmedAction();
  const swap = useTestnetSwap();
  const portfolio = usePortfolio();
  const chainId = useCurrentChainId();

  // When the user switches networks, rescope the Sell/Buy pickers to
  // valid, distinct tokens for the new chain (e.g. Base ETH/cbBTC don't
  // exist on Arc). Keeps the user's picks when they're still valid.
  useEffect(() => {
    const valid = getUserFacingTokenSymbols(chainId);
    if (valid.length === 0) return;
    const nextIn = valid.includes(tokenIn) ? tokenIn : valid[0];
    const nextOut =
      valid.includes(tokenOut) && tokenOut !== nextIn
        ? tokenOut
        : (valid.find((s) => s !== nextIn) ?? nextIn);
    /* eslint-disable react-hooks/set-state-in-effect */
    if (nextIn !== tokenIn) setTokenIn(nextIn);
    if (nextOut !== tokenOut) setTokenOut(nextOut);
    /* eslint-enable react-hooks/set-state-in-effect */
    // Rescope only when the chain changes — not on every token edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId]);

  const balanceIn = useMemo(() => {
    const b = portfolio.balances.find((x) => x.symbol === tokenIn);
    return b ? BigInt(b.balanceRaw) : 0n;
  }, [portfolio.balances, tokenIn]);
  const balanceInDisplay = useMemo(
    () => formatTokenAmount(tokenIn, balanceIn),
    [tokenIn, balanceIn],
  );

  // Probe pool depth on the active key so the chips can't overshoot.
  // Capped at 95% of the discovered max so we leave a tiny safety
  // margin against price-impact drift between the search and the
  // actual swap call.
  const poolMax = useTestnetMaxInput({
    tokenIn,
    tokenOut,
    fee,
    hook: hook === "none" ? null : hook,
    balanceRaw: balanceIn,
    enabled: balanceIn > 0n,
  });
  const cappedMax = useMemo<bigint | null>(() => {
    if (poolMax.maxInputRaw === null) return null;
    return (poolMax.maxInputRaw * 95n) / 100n;
  }, [poolMax.maxInputRaw]);

  function applyPercent(pct: number) {
    if (balanceIn === 0n) return;
    let raw = (balanceIn * BigInt(pct)) / 100n;
    if (TOKENS[tokenIn].native && pct === 100) {
      const buffer = 200_000_000_000_000n;
      raw = raw > buffer ? raw - buffer : 0n;
    }
    // Clamp to the largest amount the pool can absorb. Skip the clamp
    // when `cappedMax` is null (loading / lookup failed) OR zero (no
    // pool exists for this pair+fee+hook combo): clamping-to-zero was
    // making the chips silently do nothing on testnet pairs without
    // depth. Let the value through and surface "no pool" via the
    // quote-failure path instead.
    if (cappedMax !== null && cappedMax > 0n && raw > cappedMax) raw = cappedMax;
    setAmount(formatTokenAmount(tokenIn, raw));
  }

  const hookName: HookName | null = hook === "none" ? null : hook;
  const hookIncompatible = hookCompatibilityError(tokenIn, tokenOut, hookName);

  const amountInRaw = safeParse(tokenIn, amount);
  const quote = useTestnetQuote({
    tokenIn,
    tokenOut,
    fee,
    hook: hookName,
    amountInRaw,
    // Skip the quote round-trip when we already know the hook will
    // reject the pair on-chain — surfaces the inline reason instead.
    enabled: amountInRaw !== "0" && hookIncompatible === null,
  });

  const expectedOut = quote.data ? formatTokenAmount(tokenOut, quote.data.amountOut) : "";
  // A successful quote that returns 0 out means the pool has no usable
  // liquidity at this size — show a clear message and block the swap
  // instead of a silent "0" the user can't act on.
  const noLiquidity = quote.data !== null && BigInt(quote.data.amountOut) === 0n;

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
          {/* Input diagnostics (pool-depth cap / hook rejection) describe the
              NEXT swap, so suppress them once a swap has completed — otherwise
              a post-swap max-input probe that trips the SP circuit breaker
              shows a "rejected" banner right next to the success view. They
              return when the user starts a fresh swap ("Make another swap"). */}
          {swap.state.status !== "success" &&
            amountEntered &&
            cappedMax !== null &&
            cappedMax === 0n && (
              <div className="text-[11px] text-amber mt-1.5">
                {poolMax.reason
                  ? `Swap rejected by hook: ${humanizeRevertReason(poolMax.reason)}`
                  : `No pool found for ${tokenIn}/${tokenOut} at this fee tier and hook. Try a different fee tier, hook, or pair.`}
              </div>
            )}
          {swap.state.status !== "success" &&
            cappedMax !== null &&
            cappedMax > 0n &&
            cappedMax < balanceIn && (
              <div className="text-[11px] text-text-mute mt-1.5">
                Pool depth caps swaps at ~{formatTokenAmount(tokenIn, cappedMax)} {tokenIn}. Percent
                chips clamp here.
              </div>
            )}
          <div className="flex gap-2 mt-2.5">
            {(
              [
                { label: "25%", pct: 25 },
                { label: "50%", pct: 50 },
                { label: "75%", pct: 75 },
                { label: "Max", pct: 100 },
              ] as const
            ).map((p) => (
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
              const next = e.target.value as HookName | "none";
              setHook(next);
              // Steer the fee tier to the hook's swappable tier (DynamicFee
              // pools are only configured at 0.30%).
              setFee(
                recommendedFeeTier(
                  next === "none" ? null : next,
                  isStable(tokenIn),
                  isStable(tokenOut),
                ),
              );
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

        {hookIncompatible && (
          <p className="text-xs text-amber text-center mt-3">{hookIncompatible}</p>
        )}
        {!hookIncompatible && quote.loading && (
          <p className="text-xs text-text-dim text-center mt-3">Fetching quote…</p>
        )}
        {!hookIncompatible && quote.error && (
          <p className="text-xs text-red text-center mt-3">{quote.error.message}</p>
        )}
        {!hookIncompatible && !quote.error && noLiquidity && (
          <p className="text-xs text-amber text-center mt-3">
            Insufficient liquidity — this pool can&apos;t fill that amount. Try a smaller amount, a
            different fee tier, or another pair.
          </p>
        )}

        <Button
          variant="primary"
          size="lg"
          disabled={
            hookIncompatible !== null ||
            !quote.data ||
            noLiquidity ||
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
          {hookIncompatible
            ? "Hook unavailable for this pair"
            : !amountEntered
              ? "Enter amount"
              : noLiquidity
                ? "Insufficient liquidity"
                : ctaLabel(swap.state.status)}
        </Button>

        {swap.state.message && swap.state.status !== "idle" && swap.state.status !== "error" && (
          <p className="text-xs text-text-mute text-center mt-2">{swap.state.message}</p>
        )}

        {swap.state.approvalTx && (
          <a
            href={`${EXPLORER_TX_URL}${swap.state.approvalTx}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-text-dim hover:text-accent inline-flex items-center gap-1 justify-center mt-3 w-full"
          >
            Approval tx <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {swap.state.txHash && (
          <a
            href={`${EXPLORER_TX_URL}${swap.state.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:text-accent-2 inline-flex items-center gap-1 justify-center mt-3 w-full"
          >
            View on ArcScan <ExternalLink className="h-3 w-3" />
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

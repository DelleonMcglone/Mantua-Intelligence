import { useState } from "react";
import { ArrowDown, ExternalLink, AlertTriangle, ShieldAlert } from "lucide-react";
import { Card } from "@/components/shell/Card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useConfirmedAction } from "@/hooks/use-confirmed-action.tsx";
import type { TokenSymbol } from "@/lib/tokens.ts";
import { AmountInput } from "./AmountInput.tsx";
import { FeeArchitecture } from "./FeeArchitecture.tsx";
import { HookSelector } from "./HookSelector.tsx";
import { PegZoneIndicator } from "./PegZoneIndicator.tsx";
import { QuoteDetails } from "./QuoteDetails.tsx";
import { SlippageInput } from "./SlippageInput.tsx";
import { useQuote } from "./use-quote.ts";
import { useSwap } from "./use-swap.ts";
import { formatTokenAmount } from "./format.ts";
import { ctaLabel, mapQuoteError, mapSwapError, safeParse } from "./helpers.ts";
import { BASE_SCAN_TX, DEFAULT_SLIPPAGE_BPS } from "./constants.ts";
import {
  type HookOption,
  type PegZone,
  isBlockingZone,
  isWarningZone,
} from "./hook-types.ts";

export function SwapPanel() {
  const [tokenIn, setTokenIn] = useState<TokenSymbol>("ETH");
  const [tokenOut, setTokenOut] = useState<TokenSymbol>("USDC");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [hook, setHook] = useState<HookOption>("none");
  const confirm = useConfirmedAction();
  const swap = useSwap();

  // Phase 5 P5-003 — peg zone is hard-coded HEALTHY until the on-chain
  // status query lands. The component is wired so the value flows
  // through the warning + block logic; switching to a real source is
  // a one-prop swap.
  const pegZone: PegZone = "HEALTHY";

  const showPegZone = hook === "stable-protection";
  const blockedByZone = showPegZone && isBlockingZone(pegZone);
  const warnedByZone = showPegZone && isWarningZone(pegZone);

  const amountRaw = safeParse(tokenIn, amount);
  const quote = useQuote({
    tokenIn,
    tokenOut,
    amountRaw,
    slippageBps,
    enabled: amountRaw !== "0",
  });

  const errorMessage = mapQuoteError(quote.error);
  const expectedOut = quote.data
    ? formatTokenAmount(tokenOut, quote.data.quote.quote.output.amount)
    : "";
  const lpFeePips = quote.data?.quote.quote.fee?.amount
    ? Number(quote.data.quote.quote.fee.amount)
    : undefined;

  async function onSwap() {
    if (!quote.data) return;
    const ok = await confirm({
      title: `Swap ${amount} ${tokenIn} → ${expectedOut} ${tokenOut}`,
      description: `Slippage tolerance: ${(slippageBps / 100).toFixed(2)}%`,
      doubleConfirm: quote.data.slippageWarning === "double_confirm" || warnedByZone,
      severity:
        warnedByZone || quote.data.slippageWarning !== "ok" ? "warning" : "default",
      confirmLabel: "Sign & swap",
    });
    if (!ok) return;
    await swap.execute({ quote: quote.data, tokenIn, tokenOut, slippageBps });
  }

  return (
    <Card className="flex-1 flex flex-col gap-4 p-5 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Swap</h2>
        <SlippageInput valueBps={slippageBps} onChange={setSlippageBps} />
      </div>

      <div className="space-y-2">
        <AmountInput
          label="From"
          amount={amount}
          onAmountChange={setAmount}
          symbol={tokenIn}
          onSymbolChange={setTokenIn}
          disabledSymbol={tokenOut}
          showMax
          onMax={() => undefined /* wired in Phase 8 */}
        />
        <div className="flex justify-center -my-1">
          <button
            type="button"
            aria-label="Flip tokens"
            onClick={() => {
              setTokenIn(tokenOut);
              setTokenOut(tokenIn);
            }}
            className="bg-bg-elev border border-border rounded-sm h-8 w-8 flex items-center justify-center hover:border-text-mute transition-colors"
          >
            <ArrowDown className="h-4 w-4 text-text-dim" />
          </button>
        </div>
        <AmountInput
          label="To"
          amount={expectedOut}
          symbol={tokenOut}
          onSymbolChange={setTokenOut}
          disabledSymbol={tokenIn}
          disabled
        />
      </div>

      <HookSelector value={hook} onChange={setHook} />

      {showPegZone && <PegZoneIndicator zone={pegZone} />}

      {blockedByZone && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-sm border border-red/60 bg-red/10 p-3 text-xs text-red"
        >
          <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold">Swap blocked — pool in CRITICAL zone</div>
            <div className="text-red/80">
              Stable Protection halted swaps to prevent further peg drain. Try again once the pool returns below CRITICAL, or switch to a different hook.
            </div>
          </div>
        </div>
      )}

      {warnedByZone && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-sm border border-amber/60 bg-amber/10 p-3 text-xs"
          style={{ color: "var(--amber)" }}
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold">Pool deviation — review before swapping</div>
            <div className="text-text-dim">
              Pool is in {pegZone}. Stable Protection has raised the per-swap fee. You'll need to double-confirm at sign-off.
            </div>
          </div>
        </div>
      )}

      {quote.loading && <p className="text-xs text-text-dim text-center">Fetching quote…</p>}
      {quote.data && (
        <>
          <QuoteDetails quote={quote.data} tokenIn={tokenIn} tokenOut={tokenOut} />
          <FeeArchitecture lpFeePips={lpFeePips} hook={hook} />
        </>
      )}
      {errorMessage && <p className="text-xs text-red text-center">{errorMessage}</p>}

      <Button
        variant="primary"
        size="lg"
        disabled={
          !quote.data ||
          swap.state.status !== "idle" ||
          amountRaw === "0" ||
          blockedByZone
        }
        onClick={() => {
          void onSwap();
        }}
      >
        {blockedByZone ? "Swap blocked" : ctaLabel(swap.state.status, !quote.data)}
      </Button>

      {swap.state.txHash && (
        <a
          href={`${BASE_SCAN_TX}${swap.state.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent hover:text-accent-2 inline-flex items-center gap-1 justify-center"
        >
          View on BaseScan <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {swap.state.status === "error" && swap.state.error && (
        <p className="text-xs text-red text-center">{mapSwapError(swap.state.error)}</p>
      )}
    </Card>
  );
}

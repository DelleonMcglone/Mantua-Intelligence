import { useState } from "react";
import { ArrowDown, ExternalLink } from "lucide-react";
import { Card } from "@/components/shell/Card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useConfirmedAction } from "@/hooks/use-confirmed-action.tsx";
import type { TokenSymbol } from "@/lib/tokens.ts";
import { AmountInput } from "./AmountInput.tsx";
import { QuoteDetails } from "./QuoteDetails.tsx";
import { SlippageInput } from "./SlippageInput.tsx";
import { useQuote } from "./use-quote.ts";
import { useSwap } from "./use-swap.ts";
import { formatTokenAmount } from "./format.ts";
import { ctaLabel, mapQuoteError, mapSwapError, safeParse } from "./helpers.ts";
import { BASE_SCAN_TX, DEFAULT_SLIPPAGE_BPS } from "./constants.ts";

export function SwapPanel() {
  const [tokenIn, setTokenIn] = useState<TokenSymbol>("ETH");
  const [tokenOut, setTokenOut] = useState<TokenSymbol>("USDC");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const confirm = useConfirmedAction();
  const swap = useSwap();

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

  async function onSwap() {
    if (!quote.data) return;
    const ok = await confirm({
      title: `Swap ${amount} ${tokenIn} → ${expectedOut} ${tokenOut}`,
      description: `Slippage tolerance: ${(slippageBps / 100).toFixed(2)}%`,
      doubleConfirm: quote.data.slippageWarning === "double_confirm",
      severity: quote.data.slippageWarning !== "ok" ? "warning" : "default",
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

      {quote.loading && <p className="text-xs text-text-dim text-center">Fetching quote…</p>}
      {quote.data && <QuoteDetails quote={quote.data} tokenIn={tokenIn} tokenOut={tokenOut} />}
      {errorMessage && <p className="text-xs text-red text-center">{errorMessage}</p>}

      <Button
        variant="primary"
        size="lg"
        disabled={!quote.data || swap.state.status !== "idle" || amountRaw === "0"}
        onClick={() => {
          void onSwap();
        }}
      >
        {ctaLabel(swap.state.status, !quote.data)}
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

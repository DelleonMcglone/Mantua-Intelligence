import { useState } from "react";
import { ExternalLink, AlertTriangle, ShieldAlert, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { useConfirmedAction } from "@/hooks/use-confirmed-action.tsx";
import type { TokenSymbol } from "@/lib/tokens.ts";
import { HookSelector } from "./HookSelector.tsx";
import { PegZoneIndicator } from "./PegZoneIndicator.tsx";
import { TokenSelector } from "./TokenSelector.tsx";
import { useQuote } from "./use-quote.ts";
import { useSwap } from "./use-swap.ts";
import { formatTokenAmount } from "./format.ts";
import { ctaLabel, mapQuoteError, mapSwapError, safeParse } from "./helpers.ts";
import { BASE_SCAN_TX, DEFAULT_SLIPPAGE_BPS, MAX_SLIPPAGE_BPS } from "./constants.ts";
import {
  type HookOption,
  type PegZone,
  isBlockingZone,
  isWarningZone,
} from "./hook-types.ts";

/**
 * Swap modal — implements `mantua-ai/project/Mantua Prototype.html`'s
 * `SwapPanel` (panels_more.jsx). Layout: Sell card → flip → Buy card →
 * Swap Hook dropdown → optional Peg-Zone indicator + warnings → Exchange
 * Rate card → Fee Architecture → divider stats → Review CTA.
 */
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
  const priceImpact = quote.data?.quote.quote.priceImpact;
  const aggregated = quote.data?.quote.quote.aggregatedOutputs?.[0];
  const minOut = aggregated ? formatTokenAmount(tokenOut, aggregated.minAmount) : null;
  const rate = computeRate(amount, expectedOut, tokenIn, tokenOut);

  const amountEntered = amountRaw !== "0" && parseFloat(amount) > 0;
  const slippagePct = slippageBps / 100;

  function adjustSlippage(deltaPct: number) {
    const next = Math.max(0, Math.min(MAX_SLIPPAGE_BPS / 100, slippagePct + deltaPct));
    setSlippageBps(Math.round(next * 100));
  }

  function flip() {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
  }

  async function onSwap() {
    if (!quote.data) return;
    const ok = await confirm({
      title: `Swap ${amount} ${tokenIn} → ${expectedOut} ${tokenOut}`,
      description: `Slippage tolerance: ${slippagePct.toFixed(2)}%`,
      doubleConfirm: quote.data.slippageWarning === "double_confirm" || warnedByZone,
      severity:
        warnedByZone || quote.data.slippageWarning !== "ok" ? "warning" : "default",
      confirmLabel: "Sign & swap",
    });
    if (!ok) return;
    await swap.execute({ quote: quote.data, tokenIn, tokenOut, slippageBps });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3.5 flex items-center justify-between border-b border-border-soft">
        <h2 className="text-[20px] font-semibold">Swap</h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-5 pt-4 pb-5">
        {/* Sell card */}
        <Card>
          <div className="flex items-center justify-between text-[13px]">
            <span>Sell</span>
            <span className="text-text-dim">Balance: 0.00</span>
          </div>
          <div className="flex gap-2 mt-2.5">
            {(["25%", "50%", "75%", "Max"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className="flex-1 py-[7px] border border-border bg-transparent text-text-dim rounded-xs text-[12px] cursor-pointer font-medium hover:text-text hover:border-text-mute transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3.5">
            <div className="flex-1 min-w-0">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                }}
                placeholder="0.00"
                className={`w-full bg-transparent border-none outline-none p-0 font-mono text-[38px] font-light tracking-[-0.03em] ${
                  amountEntered ? "text-text" : "text-text-mute"
                }`}
              />
              <div className="text-[13px] text-text-mute mt-0.5">
                ≈ ${(parseFloat(amount) * 0).toFixed(2)}
              </div>
            </div>
            <TokenSelector value={tokenIn} onChange={setTokenIn} disabledSymbol={tokenOut} />
          </div>
          <div className="border-t border-border-soft mt-3.5 pt-3 flex items-center justify-between text-[13px]">
            <span className="text-text-dim">Current Price</span>
            <span className="font-mono">—</span>
          </div>
        </Card>

        {/* Flip button */}
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
        <Card>
          <div className="flex items-center justify-between text-[13px]">
            <span>Buy</span>
            <span className="text-text-dim">Balance: 0.00</span>
          </div>
          <div className="flex items-center justify-between mt-3.5">
            <div className="flex-1 min-w-0">
              <input
                value={expectedOut}
                readOnly
                placeholder="0.00"
                className="w-full bg-transparent border-none outline-none p-0 font-mono text-[38px] font-light tracking-[-0.03em] text-text-mute"
              />
              <div className="text-[13px] text-text-mute mt-0.5">≈ $0.00</div>
            </div>
            <TokenSelector value={tokenOut} onChange={setTokenOut} disabledSymbol={tokenIn} />
          </div>
          <div className="border-t border-border-soft mt-3.5 pt-3 flex items-center justify-between text-[13px]">
            <span className="text-text-dim">Current Price</span>
            <span className="font-mono">—</span>
          </div>
        </Card>

        {/* SWAP HOOK */}
        <div className="mt-5">
          <HookSelector value={hook} onChange={setHook} />
        </div>

        {/* P5-003 / P5-004 — peg zone + warnings (only when stable-protection) */}
        {showPegZone && (
          <div className="mt-3.5">
            <PegZoneIndicator zone={pegZone} />
          </div>
        )}
        {blockedByZone && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-md border border-red/60 bg-red/10 p-3 text-xs text-red"
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
            className="mt-3 flex items-start gap-2 rounded-md border border-amber/60 bg-amber/10 p-3 text-xs"
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

        {/* Exchange Rate card */}
        <div className="mt-3.5 bg-bg-elev border border-border-soft rounded-md px-4 py-3.5 flex items-center justify-between">
          <span className="text-[13px] text-text-dim">Exchange Rate (Incl. Fees)</span>
          <span className="font-mono text-[13px] font-medium">{rate || "—"}</span>
        </div>

        {/* Fee Architecture */}
        <div className="mt-5">
          <SectionLabel>Fee Architecture</SectionLabel>
          <Row label="LP Fee" value={lpFeePips !== undefined ? `${(lpFeePips / 10_000).toFixed(4)}%` : "—"} mono />
          <Row label="Hook Fee" value={hook === "none" ? "0.00%" : "Dynamic"} mono />
        </div>

        {/* Divider stats */}
        <div className="border-t border-border-soft mt-3 pt-3.5">
          <Row
            label="Price Impact"
            value={
              priceImpact !== undefined
                ? `${(priceImpact * 100).toFixed(3)}%`
                : "<0.01%"
            }
            mono
            valueClassName="text-green"
          />
          <div className="flex items-center justify-between text-[13px] py-1.5">
            <span className="text-text-dim">Max Slippage</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  adjustSlippage(-0.1);
                }}
                className="w-[22px] h-[22px] rounded-xs bg-bg-elev border border-border text-text-dim cursor-pointer text-[14px] leading-none"
                aria-label="Decrease slippage"
              >
                −
              </button>
              <span className="font-mono text-[13px] min-w-6 text-center">
                {slippagePct.toFixed(1)}
              </span>
              <span className="text-[12px] text-text-dim">%</span>
              <button
                type="button"
                onClick={() => {
                  adjustSlippage(0.1);
                }}
                className="w-[22px] h-[22px] rounded-xs bg-bg-elev border border-border text-text-dim cursor-pointer text-[14px] leading-none"
                aria-label="Increase slippage"
              >
                +
              </button>
            </div>
          </div>
          <Row label="Min. Received" value={minOut ?? "—"} mono valueClassName="text-text-dim" />
          <Row
            label="Trade Routed Through"
            value={`${tokenIn}/${tokenOut} CorePool`}
            mono
            valueClassName="text-green"
          />
        </div>

        {quote.loading && <p className="text-xs text-text-dim text-center mt-3">Fetching quote…</p>}
        {errorMessage && <p className="text-xs text-red text-center mt-3">{errorMessage}</p>}

        <Button
          variant="primary"
          size="lg"
          disabled={
            !quote.data ||
            swap.state.status !== "idle" ||
            !amountEntered ||
            blockedByZone
          }
          onClick={() => {
            void onSwap();
          }}
          className="w-full mt-4"
        >
          {blockedByZone
            ? "Swap blocked"
            : amountEntered
              ? ctaLabel(swap.state.status, !quote.data) || "Review Swap"
              : "Enter amount"}
        </Button>

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
        {swap.state.status === "error" && swap.state.error && (
          <p className="text-xs text-red text-center mt-3">{mapSwapError(swap.state.error)}</p>
        )}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3.5 mt-3 first:mt-0">
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold tracking-[0.12em] text-text-mute uppercase mb-2.5">
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
  valueClassName,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between text-[13px] py-1.5">
      <span className="text-text-dim">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${valueClassName ?? ""}`}>{value}</span>
    </div>
  );
}

function computeRate(
  inAmt: string,
  outAmt: string,
  tIn: TokenSymbol,
  tOut: TokenSymbol,
): string {
  const inN = parseFloat(inAmt);
  const outN = parseFloat(outAmt);
  if (!Number.isFinite(inN) || !Number.isFinite(outN) || inN === 0) return "";
  const rate = outN / inN;
  return `1 ${tIn} = ${rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${tOut}`;
}

// Keep ChevronDown imported even if not used here — it's part of the
// hook-selector contract on slim screens (lint guards against unused).
void ChevronDown;

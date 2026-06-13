import { useMemo, useState } from "react";
import { ArrowDown, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { type BridgeChainKey } from "./appkit.ts";
import { type TransferSpeedMode, feeTypeLabel, formatGas, useBridge } from "./use-bridge.ts";
import { ChainSelect, Row, StepIcon } from "./shared-ui.tsx";

/** Bridge tab body — USDC across chains via CCTP v2. */
export function BridgeView({
  authenticated,
  onConnect,
}: {
  authenticated: boolean;
  onConnect: () => void;
}) {
  const bridge = useBridge();
  const { state } = bridge;

  const [from, setFrom] = useState<BridgeChainKey>("ethereum-sepolia");
  const [to, setTo] = useState<BridgeChainKey>("arc");
  const [amount, setAmount] = useState("");
  const [speed, setSpeed] = useState<TransferSpeedMode>("FAST");

  const sameChain = from === to;
  const amountNum = Number(amount);
  const amountValid = amount.trim() !== "" && Number.isFinite(amountNum) && amountNum > 0;
  const currentSig = `${from}|${to}|${amount}|${speed}`;

  // The estimate is only valid for the inputs it was fetched with — track
  // a signature so changing any input flips the CTA back to "Review".
  const [quoteSig, setQuoteSig] = useState<string | null>(null);
  const hasFreshQuote = state.status === "estimated" && quoteSig === currentSig;
  const busy = state.status === "estimating" || state.status === "bridging";

  function swapDirection() {
    setFrom(to);
    setTo(from);
    bridge.reset();
    setQuoteSig(null);
  }

  function onInputChange<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      if (state.status !== "idle") bridge.reset();
      setQuoteSig(null);
    };
  }

  async function onPrimary() {
    if (!authenticated) {
      onConnect();
      return;
    }
    if (!amountValid || sameChain) return;
    const args = { from, to, amount: amount.trim(), transferSpeed: speed };
    if (hasFreshQuote) {
      await bridge.execute(args);
    } else {
      const est = await bridge.estimate(args);
      if (est) setQuoteSig(currentSig);
    }
  }

  const usdcFees = useMemo(() => {
    if (!state.estimate) return [];
    return state.estimate.fees.filter((f) => f.amount !== null);
  }, [state.estimate]);

  const totalUsdcFee = useMemo(
    () => usdcFees.reduce((sum, f) => sum + Number(f.amount ?? "0"), 0),
    [usdcFees],
  );

  const primaryLabel = !authenticated
    ? "Connect wallet"
    : state.status === "estimating"
      ? "Fetching quote…"
      : state.status === "bridging"
        ? "Bridging…"
        : hasFreshQuote
          ? "Confirm bridge"
          : "Review bridge";

  return (
    <div className="flex-1 overflow-auto px-5 pt-2 pb-5">
      {/* From */}
      <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3.5">
        <label className="text-[11px] uppercase tracking-wider text-text-dim">From</label>
        <ChainSelect value={from} onChange={onInputChange(setFrom)} id="bridge-from" />
      </div>

      <div className="flex justify-center my-2">
        <button
          type="button"
          onClick={swapDirection}
          aria-label="Swap direction"
          className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border-soft bg-bg-elev text-text-dim hover:text-text"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* To */}
      <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3.5">
        <label className="text-[11px] uppercase tracking-wider text-text-dim">To</label>
        <ChainSelect value={to} onChange={onInputChange(setTo)} id="bridge-to" />
      </div>

      {/* Amount */}
      <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3.5 mt-3">
        <label className="text-[11px] uppercase tracking-wider text-text-dim">Amount (USDC)</label>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            onInputChange(setAmount)(e.target.value);
          }}
          placeholder="0.0"
          className="w-full bg-transparent border-none outline-none text-[28px] font-mono text-text mt-1"
        />
      </div>

      {/* Transfer speed */}
      <div className="flex items-center gap-2 mt-3">
        {(["FAST", "SLOW"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              onInputChange(setSpeed)(s);
            }}
            className={`flex-1 py-2 rounded-sm border text-xs font-medium transition-colors ${
              speed === s
                ? "border-accent bg-chip text-text"
                : "border-border-soft bg-bg-elev text-text-dim hover:text-text"
            }`}
          >
            {s === "FAST" ? "Fast (CCTP v2)" : "Standard"}
          </button>
        ))}
      </div>

      {sameChain && (
        <p className="text-xs text-amber mt-3">Pick two different chains to bridge between.</p>
      )}

      {/* Quote */}
      {hasFreshQuote && state.estimate && (
        <div className="border border-border-soft rounded-md px-4 py-3 mt-3 text-[13px] space-y-1.5">
          <Row label="You send" value={`${amount} USDC`} />
          {usdcFees.map((f) => (
            <Row key={f.type} label={feeTypeLabel(f.type)} value={`${String(f.amount)} USDC`} dim />
          ))}
          <Row
            label="You receive (est.)"
            value={`~${Math.max(amountNum - totalUsdcFee, 0).toFixed(4)} USDC`}
          />
          {state.estimate.gasFees
            .filter((g) => g.fees)
            .map((g) => (
              <Row
                key={g.name}
                label={`Network gas · ${g.name}`}
                value={formatGas(g.fees?.fee, g.token)}
                dim
              />
            ))}
        </div>
      )}

      {/* Steps progress */}
      {state.steps.length > 0 && (
        <div className="border border-border-soft rounded-md px-4 py-3 mt-3 space-y-2">
          {state.steps.map((step, i) => (
            <div key={`${step.name}-${String(i)}`} className="flex items-center gap-2 text-[13px]">
              <StepIcon stateValue={step.state} />
              <span className="flex-1">{step.name}</span>
              {step.explorerUrl && (
                <a
                  href={step.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:text-accent-2 inline-flex items-center gap-1"
                >
                  tx <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {state.status === "success" && (
        <p className="text-xs text-green mt-3">
          Bridge complete — USDC minted on the destination chain.
        </p>
      )}
      {state.status === "error" && state.error && (
        <p className="text-xs text-red mt-3">{state.error.message}</p>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full mt-5"
        disabled={busy || (authenticated && (!amountValid || sameChain))}
        onClick={() => {
          void onPrimary();
        }}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {primaryLabel}
      </Button>

      {(state.status === "success" || state.status === "error") && (
        <button
          type="button"
          onClick={() => {
            bridge.reset();
            setQuoteSig(null);
          }}
          className="w-full mt-3 text-[13px] text-text-dim hover:text-text"
        >
          Bridge again
        </button>
      )}
    </div>
  );
}

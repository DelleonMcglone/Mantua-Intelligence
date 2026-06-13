import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { type BridgeChainKey } from "./appkit.ts";
import { type SendToken, useSend } from "./use-send.ts";
import { ChainSelect, StepIcon } from "./shared-ui.tsx";

/** Chains whose App Kit registry carries an `eurcAddress`. */
const EURC_CHAINS: readonly BridgeChainKey[] = ["arc", "ethereum-sepolia", "base-sepolia"];
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/** Send tab body — same-chain USDC/EURC transfer from the user's wallet. */
export function SendView({
  authenticated,
  onConnect,
}: {
  authenticated: boolean;
  onConnect: () => void;
}) {
  const send = useSend();
  const { state } = send;

  const [chain, setChain] = useState<BridgeChainKey>("arc");
  const [token, setToken] = useState<SendToken>("USDC");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");

  const eurcOk = EURC_CHAINS.includes(chain);
  const effectiveToken: SendToken = token === "EURC" && !eurcOk ? "USDC" : token;
  const amountNum = Number(amount);
  const amountValid = amount.trim() !== "" && Number.isFinite(amountNum) && amountNum > 0;
  const addressValid = ADDRESS_RE.test(to.trim());
  const ready = amountValid && addressValid;
  const busy = state.status === "sending";

  function onChainChange(v: BridgeChainKey) {
    setChain(v);
    if (state.status !== "idle") send.reset();
  }

  async function onPrimary() {
    if (!authenticated) {
      onConnect();
      return;
    }
    if (!ready) return;
    await send.execute({ chain, token: effectiveToken, to: to.trim(), amount: amount.trim() });
  }

  const primaryLabel = !authenticated
    ? "Connect wallet"
    : busy
      ? "Sending…"
      : `Send ${effectiveToken}`;

  return (
    <div className="flex-1 overflow-auto px-5 pt-2 pb-5">
      {/* Chain */}
      <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3.5">
        <label className="text-[11px] uppercase tracking-wider text-text-dim">Network</label>
        <ChainSelect value={chain} onChange={onChainChange} id="send-chain" />
      </div>

      {/* Token */}
      <div className="flex items-center gap-2 mt-3">
        {(["USDC", "EURC"] as const).map((t) => {
          const disabled = t === "EURC" && !eurcOk;
          return (
            <button
              key={t}
              type="button"
              disabled={disabled}
              onClick={() => {
                setToken(t);
                if (state.status !== "idle") send.reset();
              }}
              className={`flex-1 py-2 rounded-sm border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                effectiveToken === t
                  ? "border-accent bg-chip text-text"
                  : "border-border-soft bg-bg-elev text-text-dim hover:text-text"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>
      {token === "EURC" && !eurcOk && (
        <p className="text-xs text-text-dim mt-1.5">EURC isn’t available on this network.</p>
      )}

      {/* Recipient */}
      <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3.5 mt-3">
        <label className="text-[11px] uppercase tracking-wider text-text-dim">Recipient</label>
        <input
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            if (state.status !== "idle") send.reset();
          }}
          placeholder="0x…"
          spellCheck={false}
          className="w-full bg-transparent border-none outline-none text-[14px] font-mono text-text mt-1"
        />
      </div>
      {to.trim() !== "" && !addressValid && (
        <p className="text-xs text-amber mt-1.5">Enter a valid 0x… address.</p>
      )}

      {/* Amount */}
      <div className="bg-bg-elev border border-border-soft rounded-md px-4 py-3.5 mt-3">
        <label className="text-[11px] uppercase tracking-wider text-text-dim">
          Amount ({effectiveToken})
        </label>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            if (state.status !== "idle") send.reset();
          }}
          placeholder="0.0"
          className="w-full bg-transparent border-none outline-none text-[28px] font-mono text-text mt-1"
        />
      </div>

      {/* Result */}
      {state.step && (
        <div className="border border-border-soft rounded-md px-4 py-3 mt-3">
          <div className="flex items-center gap-2 text-[13px]">
            <StepIcon stateValue={state.step.state} />
            <span className="flex-1">{state.step.name}</span>
            {state.step.explorerUrl && (
              <a
                href={state.step.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:text-accent-2 inline-flex items-center gap-1"
              >
                tx <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {state.status === "success" && (
        <p className="text-xs text-green mt-3">Sent — transfer confirmed on-chain.</p>
      )}
      {state.status === "error" && state.error && (
        <p className="text-xs text-red mt-3">{state.error.message}</p>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full mt-5"
        disabled={busy || (authenticated && !ready)}
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
            send.reset();
          }}
          className="w-full mt-3 text-[13px] text-text-dim hover:text-text"
        >
          Send again
        </button>
      )}
    </div>
  );
}

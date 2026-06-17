import { useEffect, useState, type CSSProperties } from "react";
import { api } from "@/lib/api.ts";
import { getToken } from "@/lib/tokens.ts";
import { useAgentPortfolio } from "./use-agent-portfolio.ts";
import {
  AgentActionError,
  AgentActionSuccess,
  AgentNotReady,
  AgentWalletStrip,
  fmtUnits,
  useAgentAction,
} from "./agent-gate.tsx";
import {
  BTN_PRIMARY,
  EMBED_BODY,
  PANEL_BODY,
  PANEL_HEAD,
  PANEL_TITLE,
  TokenChip,
  X_CLOSE,
} from "./agent-primitives.tsx";

/**
 * F3 — Swap tokens from the agent wallet. Real agent address + balances
 * via `useAgentPortfolio`; the pay amount is a user input. Submitting runs
 * a real Uniswap v4 swap through `POST /api/agent/swap` (the agent's Circle
 * wallet on Arc); the received amount + tx hash come back from the server.
 */

interface Props {
  onClose: () => void;
  /** When true, render inline (no panel header / wallet strip) for the chat. */
  embedded?: boolean;
}

interface AgentSwapResult {
  txHash: string;
  explorerUrl: string;
  amountOutRaw: string;
}

const TOKEN_INPUT_STYLE: CSSProperties = {
  background: "var(--bg-elev)",
  border: "1px solid var(--border-soft)",
  borderRadius: 12,
  padding: "12px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const AMOUNT_STYLE: CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 22,
  fontWeight: 500,
  background: "transparent",
  border: "none",
  outline: "none",
  color: "var(--text)",
  minWidth: 0,
  flex: 1,
};

const TOKEN_PICK_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 99,
  background: "var(--chip)",
  border: "1px solid var(--border-soft)",
  flexShrink: 0,
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text)",
};

const LABEL_STYLE: CSSProperties = {
  fontSize: 11,
  color: "var(--text-mute)",
  letterSpacing: ".06em",
  marginBottom: 6,
};

export function SwapFlow({ onClose, embedded = false }: Props) {
  const agent = useAgentPortfolio();
  const [amount, setAmount] = useState("");
  const [quotedOut, setQuotedOut] = useState<string | null>(null);
  const swap = useAgentAction<AgentSwapResult>();

  const payBal = agent.balances.find((b) => b.symbol === "USDC") ?? agent.balances.at(0) ?? null;
  const paySym = payBal?.symbol ?? "USDC";
  const payDisplay = payBal ? fmtUnits(payBal.balanceRaw, payBal.decimals) : "0";
  const receiveSym = paySym === "USDC" ? "EURC" : "USDC";
  const busy = swap.status === "loading";

  // Live no-hook quote as the user types (debounced) — shows an estimated
  // receive amount before the swap. State is only set in async callbacks.
  useEffect(() => {
    const a = amount.trim();
    if (!a || Number(a) <= 0 || paySym === receiveSym) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ tokenIn: paySym, tokenOut: receiveSym, amountIn: a });
      void api
        .get<{ amountOutRaw: string }>(`/api/agent/swap/quote?${params.toString()}`)
        .then((r) => {
          if (!cancelled) setQuotedOut(r.amountOutRaw);
        })
        .catch(() => {
          /* leave the estimate blank on quote failure */
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [amount, paySym, receiveSym]);

  const finalOut =
    swap.status === "success" && swap.result ? swap.result.amountOutRaw : (quotedOut ?? null);
  const receiveDisplay = finalOut ? fmtUnits(finalOut, getToken(receiveSym).decimals) : "—";
  const isEstimate = swap.status !== "success" && quotedOut !== null;

  return (
    <>
      {!embedded && (
        <div style={PANEL_HEAD}>
          <div style={PANEL_TITLE}>Swap</div>
          <button type="button" style={X_CLOSE} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
      )}

      {!agent.agentAddress ? (
        <AgentNotReady agent={agent} />
      ) : (
        <>
          {!embedded && <AgentWalletStrip agent={agent} label="From agent wallet" />}
          <div style={{ ...(embedded ? EMBED_BODY : PANEL_BODY), gap: 8 }}>
            <div>
              <div style={LABEL_STYLE}>PAY</div>
              <div style={TOKEN_INPUT_STYLE}>
                <input
                  style={AMOUNT_STYLE}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setQuotedOut(null);
                    if (swap.status !== "idle") swap.reset();
                  }}
                  placeholder="0.00"
                />
                <div style={TOKEN_PICK_STYLE}>
                  <TokenChip sym={paySym} size={18} /> {paySym}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                Balance: {payDisplay} {paySym}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", margin: "-2px 0" }}>
              <span style={{ ...X_CLOSE, borderRadius: 99, color: "var(--text-mute)" }}>↓</span>
            </div>

            <div>
              <div style={LABEL_STYLE}>RECEIVE</div>
              <div style={TOKEN_INPUT_STYLE}>
                <span className="mono" style={{ ...AMOUNT_STYLE, color: "var(--text-mute)" }}>
                  {isEstimate ? `≈ ${receiveDisplay}` : receiveDisplay}
                </span>
                <div style={TOKEN_PICK_STYLE}>
                  <TokenChip sym={receiveSym} size={18} /> {receiveSym}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                {isEstimate
                  ? "Estimated from the live pool — final amount settles on-chain."
                  : "Received amount is settled on-chain by the swap."}
              </div>
            </div>

            <button
              type="button"
              style={{
                ...BTN_PRIMARY,
                width: "100%",
                padding: 12,
                marginTop: 8,
                opacity: amount && !busy ? 1 : 0.5,
              }}
              disabled={!amount || busy}
              onClick={() => {
                void swap.run(() =>
                  api.post<AgentSwapResult>("/api/agent/swap", {
                    tokenIn: paySym,
                    tokenOut: receiveSym,
                    amountIn: amount,
                  }),
                );
              }}
            >
              {busy ? "Swapping…" : "Swap"}
            </button>

            {swap.status === "success" && swap.result && (
              <AgentActionSuccess
                title={`Swapped ${amount} ${paySym} → ${receiveDisplay} ${receiveSym}`}
                txHash={swap.result.txHash}
                explorerUrl={swap.result.explorerUrl}
              />
            )}
            {swap.status === "error" && swap.error && <AgentActionError message={swap.error} />}
          </div>
        </>
      )}
    </>
  );
}

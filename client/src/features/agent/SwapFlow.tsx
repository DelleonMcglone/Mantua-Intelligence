import { useState, type CSSProperties } from "react";
import { useAgentPortfolio } from "./use-agent-portfolio.ts";
import {
  AgentNotReady,
  AgentUnavailableNotice,
  AgentWalletStrip,
  fmtUnits,
} from "./agent-gate.tsx";
import {
  BTN_PRIMARY,
  PANEL_BODY,
  PANEL_HEAD,
  PANEL_TITLE,
  TokenChip,
  X_CLOSE,
} from "./agent-primitives.tsx";

/**
 * F3 — Swap tokens from the agent wallet. Real agent address + balances
 * via `useAgentPortfolio`; the pay amount is a user input. The previous
 * mock peg-zone theater (MODERATE/CRITICAL rings, a "Demo: simulate
 * CRITICAL peg" button, hardcoded 100 USDC → 0.02756 ETH quotes and a
 * fake tx hash) is gone. Agent swap routing/quoting/execution isn't wired
 * yet, so the receive side reads "—" and submitting shows an honest
 * notice instead of fabricating a result.
 */

interface Props {
  onClose: () => void;
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

export function SwapFlow({ onClose }: Props) {
  const agent = useAgentPortfolio();
  const [amount, setAmount] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const payBal = agent.balances.find((b) => b.symbol === "USDC") ?? agent.balances.at(0) ?? null;
  const paySym = payBal?.symbol ?? "USDC";
  const payDisplay = payBal ? fmtUnits(payBal.balanceRaw, payBal.decimals) : "0";
  const receiveSym = paySym === "ETH" ? "USDC" : "ETH";

  return (
    <>
      <div style={PANEL_HEAD}>
        <div style={PANEL_TITLE}>Swap</div>
        <button type="button" style={X_CLOSE} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {!agent.agentAddress ? (
        <AgentNotReady agent={agent} />
      ) : (
        <>
          <AgentWalletStrip agent={agent} label="From agent wallet" />
          <div style={{ ...PANEL_BODY, gap: 8 }}>
            <div>
              <div style={LABEL_STYLE}>PAY</div>
              <div style={TOKEN_INPUT_STYLE}>
                <input
                  style={AMOUNT_STYLE}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setSubmitted(false);
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
                  —
                </span>
                <div style={TOKEN_PICK_STYLE}>
                  <TokenChip sym={receiveSym} size={18} /> {receiveSym}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                Quote appears once agent swap routing is live.
              </div>
            </div>

            <button
              type="button"
              style={{
                ...BTN_PRIMARY,
                width: "100%",
                padding: 12,
                marginTop: 8,
                opacity: amount ? 1 : 0.5,
              }}
              disabled={!amount}
              onClick={() => {
                setSubmitted(true);
              }}
            >
              Review swap
            </button>

            {submitted && <AgentUnavailableNotice action="swaps" />}
          </div>
        </>
      )}
    </>
  );
}

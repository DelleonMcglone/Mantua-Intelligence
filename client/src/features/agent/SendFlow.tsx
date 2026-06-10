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
 * F2 — Send tokens from the agent wallet. Real agent address + balances
 * via `useAgentPortfolio`; recipient and amount are user inputs (no more
 * pre-filled vitalik.eth / fake resolved address / fake RECENT list).
 * On-chain agent sends aren't wired yet, so submitting shows an honest
 * notice instead of fabricating a tx hash + success.
 */

interface Props {
  onClose: () => void;
}

const INPUT_STYLE: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--bg-elev)",
  border: "1px solid var(--border-soft)",
  borderRadius: 10,
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const LABEL_STYLE: CSSProperties = {
  fontSize: 11,
  color: "var(--text-mute)",
  letterSpacing: ".06em",
  marginBottom: 6,
};

export function SendFlow({ onClose }: Props) {
  const agent = useAgentPortfolio();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const bal = agent.balances.find((b) => b.symbol === "USDC") ?? agent.balances.at(0) ?? null;
  const sym = bal?.symbol ?? "USDC";
  const balDisplay = bal ? fmtUnits(bal.balanceRaw, bal.decimals) : "0";

  return (
    <>
      <div style={PANEL_HEAD}>
        <div style={PANEL_TITLE}>Send</div>
        <button type="button" style={X_CLOSE} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {!agent.agentAddress ? (
        <AgentNotReady agent={agent} />
      ) : (
        <>
          <AgentWalletStrip agent={agent} label="From agent wallet" />
          <div style={PANEL_BODY}>
            <div>
              <div style={LABEL_STYLE}>RECIPIENT</div>
              <input
                style={INPUT_STYLE}
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  setSubmitted(false);
                }}
                placeholder="0x… address"
              />
            </div>

            <div>
              <div style={LABEL_STYLE}>AMOUNT</div>
              <div
                style={{
                  background: "var(--bg-elev)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <input
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setSubmitted(false);
                  }}
                  placeholder="0.00"
                  className="mono"
                  style={{
                    fontSize: 22,
                    fontWeight: 500,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--text)",
                    minWidth: 0,
                    flex: 1,
                  }}
                />
                <div
                  style={{
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
                  }}
                >
                  <TokenChip sym={sym} size={18} /> {sym}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
                Agent balance: {balDisplay} {sym}
              </div>
            </div>

            <button
              type="button"
              style={{
                ...BTN_PRIMARY,
                width: "100%",
                padding: 12,
                opacity: recipient && amount ? 1 : 0.5,
              }}
              disabled={!recipient || !amount}
              onClick={() => {
                setSubmitted(true);
              }}
            >
              Send
            </button>

            {submitted && <AgentUnavailableNotice action="sends" />}
          </div>
        </>
      )}
    </>
  );
}

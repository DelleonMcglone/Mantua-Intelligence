import { useState, type CSSProperties } from "react";
import { api } from "@/lib/api.ts";
import { ACTIVE_CHAIN_ID, getUserFacingTokenSymbols } from "@/lib/tokens.ts";
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
 * F2 — Send tokens from the agent wallet. Real agent address + balances
 * via `useAgentPortfolio`; recipient and amount are user inputs. Submitting
 * runs a real ERC-20 transfer through `POST /api/agent/send` (the agent's
 * Circle wallet on Arc) and surfaces the tx hash + ArcScan link on success.
 */

interface Props {
  onClose: () => void;
  /** When true, render inline (no panel header / wallet strip) for the chat. */
  embedded?: boolean;
}

interface AgentSendResult {
  txHash: string;
  explorerUrl: string;
  agentAddress: string;
  usdValue: number;
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

const SELECT_STYLE: CSSProperties = {
  background: "transparent",
  border: "none",
  outline: "none",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 500,
  fontFamily: "inherit",
  cursor: "pointer",
};

const SYMBOLS = getUserFacingTokenSymbols(ACTIVE_CHAIN_ID);

export function SendFlow({ onClose, embedded = false }: Props) {
  const agent = useAgentPortfolio();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sym, setSym] = useState<string>(SYMBOLS[0] ?? "USDC");
  const send = useAgentAction<AgentSendResult>();

  const bal = agent.balances.find((b) => b.symbol === sym) ?? null;
  const balDisplay = bal ? fmtUnits(bal.balanceRaw, bal.decimals) : "0";
  const busy = send.status === "loading";

  return (
    <>
      {!embedded && (
        <div style={PANEL_HEAD}>
          <div style={PANEL_TITLE}>Send</div>
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
          <div style={embedded ? EMBED_BODY : PANEL_BODY}>
            <div>
              <div style={LABEL_STYLE}>RECIPIENT</div>
              <input
                style={INPUT_STYLE}
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  if (send.status !== "idle") send.reset();
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
                    if (send.status !== "idle") send.reset();
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
                  <TokenChip sym={sym} size={18} />
                  <select
                    value={sym}
                    onChange={(e) => {
                      setSym(e.target.value);
                      if (send.status !== "idle") send.reset();
                    }}
                    style={SELECT_STYLE}
                    aria-label="Token"
                  >
                    {SYMBOLS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
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
                opacity: recipient && amount && !busy ? 1 : 0.5,
              }}
              disabled={!recipient || !amount || busy}
              onClick={() => {
                void send.run(() =>
                  api.post<AgentSendResult>("/api/agent/send", {
                    to: recipient,
                    amount,
                    token: sym,
                  }),
                );
              }}
            >
              {busy ? "Sending…" : "Send"}
            </button>

            {send.status === "success" && send.result && (
              <AgentActionSuccess
                title={`Sent ${amount} ${sym}`}
                txHash={send.result.txHash}
                explorerUrl={send.result.explorerUrl}
              />
            )}
            {send.status === "error" && send.error && <AgentActionError message={send.error} />}
          </div>
        </>
      )}
    </>
  );
}

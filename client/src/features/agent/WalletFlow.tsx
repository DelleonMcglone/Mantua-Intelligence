import { useState } from "react";
import { useAgentPortfolio } from "./use-agent-portfolio.ts";
import {
  AgentNotReady,
  AgentUnavailableNotice,
  AgentWalletStrip,
  fmtUnits,
  fmtUsd,
} from "./agent-gate.tsx";
import {
  BigVal,
  BTN_GHOST,
  PANEL_BODY,
  PANEL_HEAD,
  PANEL_TITLE,
  TokenChip,
  X_CLOSE,
} from "./agent-primitives.tsx";

/**
 * F1 — Agent wallet. Read-only view of the LIVE CDP agent wallet
 * (address + balances + total value) via `useAgentPortfolio`. When no
 * agent wallet is provisioned, shows an honest empty state. Fund /
 * withdraw run through the agent wallet once on-chain execution ships —
 * surfaced as an explicit "not available yet" notice rather than the old
 * mock provision/fund/withdraw simulation.
 */

interface Props {
  onClose: () => void;
}

export function WalletFlow({ onClose }: Props) {
  const agent = useAgentPortfolio();
  const [showNotice, setShowNotice] = useState(false);
  const total = agent.balances.reduce((sum, b) => sum + b.usdValue, 0);

  return (
    <>
      <div style={PANEL_HEAD}>
        <div style={PANEL_TITLE}>
          <span style={{ fontSize: 14 }}>🤖</span> Agent wallet
        </div>
        <button type="button" style={X_CLOSE} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {!agent.agentAddress ? (
        <AgentNotReady agent={agent} />
      ) : (
        <>
          <AgentWalletStrip agent={agent} />
          <div style={{ ...PANEL_BODY, padding: 0 }}>
            <div style={{ padding: 14 }}>
              <BigVal label="TOTAL VALUE" value={fmtUsd(total)} padding="14px 12px" />
            </div>

            <div style={{ borderTop: "1px solid var(--border-soft)" }}>
              {agent.balances.length === 0 ? (
                <div
                  style={{
                    padding: 22,
                    textAlign: "center",
                    fontSize: 12,
                    color: "var(--text-dim)",
                  }}
                >
                  No balances yet. Fund the agent wallet to get started.
                </div>
              ) : (
                agent.balances.map((b) => (
                  <AssetRow
                    key={b.symbol}
                    sym={b.symbol}
                    qty={fmtUnits(b.balanceRaw, b.decimals)}
                    usd={fmtUsd(b.usdValue)}
                  />
                ))
              )}
            </div>

            <div style={{ padding: 14, borderTop: "1px solid var(--border-soft)" }}>
              <button
                type="button"
                style={{ ...BTN_GHOST, width: "100%" }}
                onClick={() => {
                  setShowNotice(true);
                }}
              >
                Fund / withdraw
              </button>
              {showNotice && (
                <div style={{ marginTop: 10 }}>
                  <AgentUnavailableNotice action="funding & withdrawals" />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function AssetRow({ sym, qty, usd }: { sym: string; qty: string; usd: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderBottom: "1px solid var(--border-soft)",
      }}
    >
      <TokenChip sym={sym} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{sym}</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>
          {qty}
        </div>
      </div>
      <div className="mono" style={{ textAlign: "right", fontSize: 13 }}>
        {usd}
      </div>
    </div>
  );
}

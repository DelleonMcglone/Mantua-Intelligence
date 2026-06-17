import { api } from "@/lib/api.ts";
import { useAgentPortfolio } from "./use-agent-portfolio.ts";
import {
  AgentActionSuccess,
  AgentNotReady,
  AgentWalletStrip,
  fmtUnits,
  fmtUsd,
  useAgentAction,
} from "./agent-gate.tsx";
import {
  Banner,
  BigVal,
  BTN_GHOST,
  PANEL_BODY,
  PANEL_HEAD,
  PANEL_TITLE,
  TokenChip,
  X_CLOSE,
} from "./agent-primitives.tsx";

/**
 * F1 — Agent wallet. Read-only view of the LIVE Circle agent wallet on Arc
 * (address + balances + total value) via `useAgentPortfolio`. When no agent
 * wallet is provisioned, shows an honest empty state with a provision
 * button. "Fund" requests testnet USDC from Circle's faucet via
 * `POST /api/agent/fund`; balances re-poll once it lands.
 */

interface Props {
  onClose: () => void;
}

interface AgentFundResult {
  agentAddress: string;
  blockchain: string;
}

export function WalletFlow({ onClose }: Props) {
  const agent = useAgentPortfolio();
  const fund = useAgentAction<AgentFundResult>();
  const total = agent.balances.reduce((sum, b) => sum + b.usdValue, 0);
  const funding = fund.status === "loading";

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
                disabled={funding}
                style={{ ...BTN_GHOST, width: "100%", opacity: funding ? 0.6 : 1 }}
                onClick={() => {
                  void fund.run(() => api.post<AgentFundResult>("/api/agent/fund", {}));
                }}
              >
                {funding ? "Requesting…" : "Fund with testnet USDC"}
              </button>
              {fund.status === "success" && (
                <div style={{ marginTop: 10 }}>
                  <AgentActionSuccess
                    title="Faucet requested"
                    detail="Circle is sending testnet USDC to the agent wallet — balances refresh once it lands."
                  />
                </div>
              )}
              {fund.status === "error" && fund.error && (
                <div style={{ marginTop: 10 }}>
                  <Banner tone="warn" icon="⚠" title="Use the public faucet">
                    {fund.error}
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      <a
                        href="https://faucet.circle.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--accent)", textDecoration: "none" }}
                      >
                        Open faucet.circle.com ↗
                      </a>
                      {agent.agentAddress && (
                        <span className="mono" style={{ color: "var(--text-dim)", fontSize: 11 }}>
                          {agent.agentAddress}
                        </span>
                      )}
                    </div>
                  </Banner>
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

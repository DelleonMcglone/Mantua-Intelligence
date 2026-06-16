/* eslint-disable react-refresh/only-export-components -- co-located gate helpers + component by design. */
import { useCurrentChainId } from "@/lib/chain-context.tsx";
import { getExplorerAddressUrl } from "@/lib/chains.ts";
import { AgentStrip } from "./AgentStrip.tsx";
import { Banner, PANEL_BODY, Spinner } from "./agent-primitives.tsx";
import type { AgentPortfolioState } from "./use-agent-portfolio.ts";

/**
 * Shared gating + formatting for the agent flows. The flows used to ship
 * hardcoded mock data (fake addresses, balances, tx hashes, and
 * setTimeout-driven "execution"). They now render the LIVE agent wallet
 * via `useAgentPortfolio`, with honest states when it isn't ready and an
 * explicit notice for actions whose on-chain execution isn't wired yet.
 */

export function shortAddr(addr: string): string {
  return addr.length <= 12 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function fmtUnits(balanceRaw: string, decimals: number): string {
  const n = Number(balanceRaw) / Math.pow(10, decimals);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals >= 8 ? 6 : 4 });
}

export function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0.00";
  if (n > 0 && n < 0.01) return "<$0.01";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** AgentStrip wired to the live agent wallet address + explorer link. */
export function AgentWalletStrip({
  agent,
  label = "Agent wallet",
}: {
  agent: AgentPortfolioState;
  label?: string;
}) {
  const chainId = useCurrentChainId();
  if (!agent.agentAddress) return null;
  const url = getExplorerAddressUrl(chainId, agent.agentAddress);
  return (
    <AgentStrip
      label={label}
      addr={
        <>
          {shortAddr(agent.agentAddress)}{" "}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text-dim)", marginLeft: 4, textDecoration: "none" }}
          >
            ↗
          </a>
        </>
      }
    />
  );
}

/**
 * Honest non-ready states shared by every agent flow: loading, error, or
 * no-agent-wallet. Returns `null` when the agent wallet is ready (the
 * caller then renders the real flow).
 */
export function AgentNotReady({ agent }: { agent: AgentPortfolioState }) {
  if (agent.agentAddress) return null;

  if (agent.loading) {
    return (
      <div style={{ ...PANEL_BODY, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Spinner size="lg" agent />
        <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Loading agent wallet…</div>
      </div>
    );
  }

  if (agent.error) {
    return (
      <div style={PANEL_BODY}>
        <Banner tone="error" icon="⊘" title="Couldn't load agent wallet">
          {agent.error}
        </Banner>
      </div>
    );
  }

  // notProvisioned, or no wallet connected / not authenticated.
  return (
    <div
      style={{
        ...PANEL_BODY,
        alignItems: "center",
        textAlign: "center",
        gap: 12,
        justifyContent: "center",
      }}
    >
      <div style={{ fontSize: 44 }} aria-hidden>
        🤖
      </div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>No agent wallet yet</div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", maxWidth: 300, lineHeight: 1.55 }}>
        Connect your wallet and provision a CDP-managed agent wallet to use agent actions. Your real
        balances and activity will appear here.
      </div>
    </div>
  );
}

/** Honest "this action isn't wired to execute yet" notice — replaces the
 *  old fake success/tx-hash theater. */
export function AgentUnavailableNotice({ action }: { action: string }) {
  return (
    <Banner tone="info" icon="ℹ" title={`Agent ${action} isn't available yet`}>
      This will run through your agent wallet once on-chain execution ships. Nothing has been
      submitted.
    </Banner>
  );
}

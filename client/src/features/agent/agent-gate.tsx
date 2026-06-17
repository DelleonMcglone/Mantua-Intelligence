/* eslint-disable react-refresh/only-export-components -- co-located gate helpers + component by design. */
import { useCallback, useState } from "react";
import { ApiError, api } from "@/lib/api.ts";
import { useCurrentChainId } from "@/lib/chain-context.tsx";
import { getExplorerAddressUrl } from "@/lib/chains.ts";
import { AgentStrip } from "./AgentStrip.tsx";
import {
  Banner,
  BTN_PRIMARY,
  CopyButton,
  PANEL_BODY,
  Spinner,
  TxRow,
} from "./agent-primitives.tsx";
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

// ── Agent action runner ────────────────────────────────────────────

type AgentActionStatus = "idle" | "loading" | "success" | "error";

export interface AgentActionState<T> {
  status: AgentActionStatus;
  error: string | null;
  result: T | null;
  /** Run an async action; tracks status and re-polls the portfolio on success. */
  run: (fn: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
}

/**
 * Shared async runner for the agent action flows (send / swap / fund /
 * provision). Tracks idle→loading→success/error, pulls a friendly message
 * off `ApiError`, and on success fires `mantua:refresh-portfolio` so the
 * live balances re-poll.
 */
export function useAgentAction<T>(): AgentActionState<T> {
  const [status, setStatus] = useState<AgentActionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);

  const run = useCallback(async (fn: () => Promise<T>): Promise<T | null> => {
    setStatus("loading");
    setError(null);
    try {
      const r = await fn();
      setResult(r);
      setStatus("success");
      window.dispatchEvent(new Event("mantua:refresh-portfolio"));
      return r;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong";
      setError(message);
      setStatus("error");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setResult(null);
  }, []);

  return { status, error, result, run, reset };
}

/** Error banner for a failed agent action. */
export function AgentActionError({ message }: { message: string }) {
  return (
    <Banner tone="error" icon="⊘" title="Action failed">
      {message}
    </Banner>
  );
}

/** Success banner + ArcScan tx row for a completed agent action. */
export function AgentActionSuccess({
  title,
  detail = "Submitted through your agent wallet on Arc.",
  txHash,
  explorerUrl,
}: {
  title: string;
  detail?: string;
  txHash?: string;
  explorerUrl?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Banner tone="success" icon="✓" title={title}>
        {detail}
      </Banner>
      {txHash && <TxRow hash={txHash} {...(explorerUrl ? { explorerUrl } : {})} />}
    </div>
  );
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
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {shortAddr(agent.agentAddress)}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text-dim)", textDecoration: "none" }}
          >
            ↗
          </a>
          <CopyButton value={agent.agentAddress} label="Copy agent address" />
        </span>
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
  return <AgentProvision notProvisioned={agent.notProvisioned} />;
}

/**
 * Empty state for users without an agent wallet. When the portfolio call
 * reported `notProvisioned` (authenticated, just no wallet yet), offers a
 * real "Create agent wallet" button that provisions a Circle-managed Arc
 * wallet via `POST /api/agent/wallet`; a successful create re-polls the
 * portfolio and the flow swaps to its live view.
 */
function AgentProvision({ notProvisioned }: { notProvisioned: boolean }) {
  const provision = useAgentAction<{ address: string }>();
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
        {notProvisioned
          ? "Provision a Circle-managed agent wallet on Arc to run sends, swaps, and autonomous actions. Your real balances and activity will appear here."
          : "Connect your wallet to provision a Circle-managed agent wallet on Arc. Your real balances and activity will appear here."}
      </div>
      {notProvisioned && (
        <button
          type="button"
          disabled={provision.status === "loading"}
          style={{
            ...BTN_PRIMARY,
            padding: "10px 18px",
            opacity: provision.status === "loading" ? 0.6 : 1,
          }}
          onClick={() => {
            void provision.run(() => api.post<{ address: string }>("/api/agent/wallet", {}));
          }}
        >
          {provision.status === "loading" ? "Creating…" : "Create agent wallet"}
        </button>
      )}
      {provision.status === "error" && provision.error && (
        <div style={{ width: "100%" }}>
          <AgentActionError message={provision.error} />
        </div>
      )}
    </div>
  );
}

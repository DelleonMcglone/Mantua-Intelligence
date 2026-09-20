import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { api } from "@/lib/api.ts";
import { useCurrentChainId } from "@/lib/chain-context.tsx";
import { type TokenSymbol } from "@/lib/tokens.ts";
import { useAgentPortfolio } from "@/features/agent/use-agent-portfolio.ts";
import { AssetIcon, type AssetSymbol } from "./asset-icons.tsx";
import { toDisplayAssets, usePortfolio, type DisplayAsset } from "./use-portfolio.ts";
import { UnifiedBalanceTab } from "./UnifiedBalanceTab.tsx";
import { useUnifiedBalance } from "./use-unified-balance.ts";

const SORTS = ["Descending", "Ascending", "Alphabetical"] as const;
type Sort = (typeof SORTS)[number];

interface AssetsCardProps {
  /** Navigate to the AssetDetailPanel for the clicked balance row. */
  onSelectAsset?: (symbol: TokenSymbol) => void;
}

/**
 * Assets card — tabbed balances surface: your assets, your agent's
 * wallet, and the agent's unified (Gateway) balance. The LP positions and
 * earnings tabs left with the liquidity surfaces (task 001).
 */
export function AssetsCard({ onSelectAsset }: AssetsCardProps = {}) {
  const chainId = useCurrentChainId();
  const [tab, setTab] = useState<"assets" | "agent" | "unified">("assets");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("Descending");
  const [openSort, setOpenSort] = useState(false);
  const portfolio = usePortfolio();
  const agent = useAgentPortfolio();
  // Agent treasury (Circle Gateway) — fetched here so the tab count and the
  // tab body share one request.
  const unifiedBalance = useUnifiedBalance();
  const assets = useMemo<DisplayAsset[]>(() => {
    if (!portfolio.walletAddress) return [];
    return toDisplayAssets(portfolio.balances, chainId);
  }, [portfolio.walletAddress, portfolio.balances, chainId]);
  const agentAssets = useMemo<DisplayAsset[]>(() => {
    if (!agent.agentAddress) return [];
    return toDisplayAssets(agent.balances, chainId);
  }, [agent.agentAddress, agent.balances, chainId]);
  const numVal = (s: string) => Number(s.replace(/[^\d.-]/g, "")) || 0;
  const filtered = assets
    .filter(
      (a) =>
        !q ||
        a.symbol.toLowerCase().includes(q.toLowerCase()) ||
        a.name.toLowerCase().includes(q.toLowerCase()),
    )
    .slice()
    .sort((a, b) => {
      if (sort === "Alphabetical") return a.name.localeCompare(b.name);
      if (sort === "Ascending") return numVal(a.val) - numVal(b.val);
      return numVal(b.val) - numVal(a.val);
    });

  const tabs = [
    { k: "assets" as const, label: "Assets", count: assets.length },
    { k: "agent" as const, label: "Agent", count: agentAssets.length },
    {
      k: "unified" as const,
      label: "Unified Balance",
      // Chains currently holding part of the unified balance.
      count: unifiedBalance.data?.breakdown?.filter((b) => Number(b.amount) > 0).length ?? 0,
    },
  ];

  return (
    <div className="bg-panel-solid border border-border-soft rounded-md p-0">
      <div className="px-3.5 pt-2.5 border-b border-border-soft">
        <div className="flex gap-0.5">
          {tabs.map((t) => {
            const active = tab === t.k;
            return (
              <button
                key={t.k}
                type="button"
                onClick={() => {
                  setTab(t.k);
                }}
                className={`-mb-px px-3.5 py-2 bg-transparent border-none cursor-pointer text-[13px] font-medium inline-flex items-center gap-1.5 border-b-2 ${
                  active ? "text-text border-accent" : "text-text-dim border-transparent"
                }`}
              >
                {t.label}
                <span
                  className={`text-[10px] px-1.5 py-px rounded-full font-mono border border-border-soft text-text-mute ${
                    active ? "bg-chip" : "bg-transparent"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === "assets" && (
        <>
          <div className="px-4 py-3.5 border-b border-border-soft flex items-center gap-2.5">
            <Search className="h-4 w-4 text-text-dim" />
            <div className="flex-1">
              <div className="text-[13px] font-medium">Assets</div>
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                }}
                placeholder="Search assets"
                className="border-none bg-transparent outline-none text-[12px] text-text-dim w-full p-0 mt-0.5"
              />
            </div>
          </div>

          <div className="px-3.5 py-2.5 flex gap-2 items-center border-b border-border-soft relative">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setOpenSort((v) => !v);
                }}
                className="px-2.5 py-1 rounded-full border border-border bg-bg-elev text-text-dim text-[12px] inline-flex items-center gap-1"
              >
                {sort}
                <ChevronDown className="h-3 w-3" />
              </button>
              {openSort && (
                <div className="absolute top-[calc(100%+4px)] left-0 z-20 bg-panel-solid border border-border rounded-sm p-1 min-w-[140px] shadow-lg">
                  {SORTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSort(s);
                        setOpenSort(false);
                      }}
                      className={`block w-full px-2.5 py-2 border-none rounded-xs cursor-pointer text-text text-[13px] text-left ${
                        sort === s ? "bg-chip" : "bg-transparent"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1" />
            <div className="text-[12px] text-text-dim">PnL</div>
          </div>

          <div className="max-h-[320px] overflow-auto">
            {!portfolio.walletAddress && (
              <div className="px-4 py-8 text-center text-[12px] text-text-dim">
                Connect a wallet to see your balances.
              </div>
            )}
            {portfolio.walletAddress && portfolio.loading && filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px] text-text-dim">
                Loading balances…
              </div>
            )}
            {portfolio.walletAddress && portfolio.error && filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px] text-red">{portfolio.error}</div>
            )}
            {portfolio.walletAddress &&
              !portfolio.loading &&
              !portfolio.error &&
              filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-[12px] text-text-dim">
                  No matching balances.
                </div>
              )}
            {filtered.map((a) => (
              <div
                key={a.symbol}
                onClick={
                  onSelectAsset
                    ? () => {
                        onSelectAsset(a.symbol);
                      }
                    : undefined
                }
                role={onSelectAsset ? "button" : undefined}
                tabIndex={onSelectAsset ? 0 : undefined}
                onKeyDown={
                  onSelectAsset
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectAsset(a.symbol);
                        }
                      }
                    : undefined
                }
                className="flex items-center gap-3 px-4 py-3 border-b border-border-soft cursor-pointer transition-colors hover:bg-row-hover"
              >
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 flex">
                  <AssetRowIcon symbol={a.symbol} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-[14px]">{a.name}</span>
                  </div>
                  <div className="text-[12px] text-text-dim mt-0.5">
                    {a.symbol} · {a.price}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-medium font-mono">{a.qty}</div>
                  <div className="text-[12px] text-text-dim font-mono">{a.val}</div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-text-mute" />
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "agent" && <AgentTabBody agent={agent} agentAssets={agentAssets} />}

      {tab === "unified" && <UnifiedBalanceTab ub={unifiedBalance} />}
    </div>
  );
}

function AgentTabBody({
  agent,
  agentAssets,
}: {
  agent: ReturnType<typeof useAgentPortfolio>;
  agentAssets: DisplayAsset[];
}) {
  if (!agent.agentAddress && agent.loading) {
    return (
      <div className="px-4 py-8 text-center text-[12px] text-text-dim">Loading agent wallet…</div>
    );
  }
  if (agent.notProvisioned) {
    return (
      <div className="px-4 py-8 text-center text-[12px] text-text-dim">
        No agent wallet yet. Open the Agent panel to create one.
      </div>
    );
  }
  if (agent.error) {
    return <div className="px-4 py-8 text-center text-[12px] text-red">{agent.error}</div>;
  }
  if (!agent.agentAddress) {
    return (
      <div className="px-4 py-8 text-center text-[12px] text-text-dim">
        Connect a wallet to view your agent.
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-3 border-b border-border-soft">
        <div className="text-[11px] text-text-mute">Agent wallet</div>
        <div className="font-mono text-[12px] mt-0.5">{shortenAddress(agent.agentAddress)}</div>
      </div>

      <AutoRebalanceToggle />

      <div className="px-3.5 pt-3 pb-1.5 text-[11px] text-text-mute uppercase tracking-wide">
        Balances
      </div>
      {agentAssets.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-text-dim">
          Agent has no balances yet. Send funds to the address above.
        </div>
      ) : (
        agentAssets.map((a) => (
          <div
            key={a.symbol}
            className="flex items-center gap-3 px-4 py-3 border-b border-border-soft"
          >
            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 flex">
              <AssetRowIcon symbol={a.symbol} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[14px]">{a.name}</div>
              <div className="text-[12px] text-text-dim mt-0.5">
                {a.symbol} · {a.price}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[14px] font-medium font-mono">{a.qty}</div>
              <div className="text-[12px] text-text-dim font-mono">{a.val}</div>
            </div>
          </div>
        ))
      )}
    </>
  );
}

/**
 * Opt-in toggle for autonomous peg de-peg-exit rebalancing. Reads the current
 * setting from the agent-wallet DTO and PATCHes /api/agent/rebalance on change.
 */
function AutoRebalanceToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ rebalanceEnabled: boolean }>("/api/agent/wallet")
      .then((w) => {
        if (!cancelled) setEnabled(w.rebalanceEnabled);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggle = () => {
    if (enabled === null || busy) return;
    const next = !enabled;
    setBusy(true);
    setEnabled(next); // optimistic
    api
      .patch<{ rebalanceEnabled: boolean }>("/api/agent/rebalance", { enabled: next })
      .then((w) => {
        setEnabled(w.rebalanceEnabled);
      })
      .catch(() => {
        setEnabled(!next); // revert
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <div className="px-4 py-3 border-b border-border-soft flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[12px] font-medium">Auto-rebalance · de-peg protection</div>
        <div className="text-[11px] text-text-mute mt-0.5">
          If USDC/EURC drifts off peg, the agent swaps it to the on-peg stable (checked daily).
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled === true}
        disabled={enabled === null || busy}
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
          enabled ? "bg-accent" : "bg-border-soft"
        } ${enabled === null || busy ? "opacity-50" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function shortenAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const KNOWN_ASSETS: AssetSymbol[] = ["USDC", "EURC", "cirBTC"];

function AssetRowIcon({ symbol }: { symbol: string }) {
  const norm = symbol === "WETH" ? "ETH" : symbol;
  if ((KNOWN_ASSETS as readonly string[]).includes(norm)) {
    return <AssetIcon symbol={norm as AssetSymbol} size={28} />;
  }
  const initial = symbol.slice(0, 1).toUpperCase();
  return (
    <svg width={28} height={28} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#3b3b46" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="#fff"
        fontFamily="Inter, sans-serif"
      >
        {initial}
      </text>
    </svg>
  );
}

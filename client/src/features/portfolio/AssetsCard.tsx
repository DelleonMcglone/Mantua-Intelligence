import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useCurrentChainId } from "@/lib/chain-context.tsx";
import { CHAIN_INFO } from "@/lib/chains.ts";
import { IS_MAINNET, type TokenSymbol } from "@/lib/tokens.ts";
import { FEE_TIER_LABELS } from "@/features/liquidity/fee-tiers.ts";
import {
  getAgentLocalPositions,
  getUserLocalPositions,
  type LocalPosition,
} from "@/features/liquidity/local-positions.ts";
import { localPoolKey } from "@/features/liquidity/local-pools.ts";
import { useAgentPortfolio } from "@/features/agent/use-agent-portfolio.ts";
import { AssetIcon, type AssetSymbol } from "./asset-icons.tsx";
import { toDisplayAssets, usePortfolio, type DisplayAsset } from "./use-portfolio.ts";

type HookName = "Stable Protection" | "Dynamic Fee" | "Volatile";

interface PortfolioPosition {
  a: AssetSymbol;
  b: AssetSymbol;
  fee: string;
  value: string;
  pnl: string;
  pct: string;
  up: boolean;
  source: "mantua" | "external";
  hook: HookName;
  /** Original LocalPosition for testnet rows — present iff the row
   *  came from `localPositions.map(localPositionToRow)`. Used to
   *  derive the `local:*` pool id for the click-through nav. */
  src?: LocalPosition;
}

const HOOK_TINT: Record<HookName, { bg: string; fg: string; bd: string }> = {
  "Dynamic Fee": { bg: "rgba(230,199,74,0.12)", fg: "#e6c74a", bd: "rgba(230,199,74,0.35)" },
  "Stable Protection": { bg: "rgba(61,220,151,0.12)", fg: "#3ddc97", bd: "rgba(61,220,151,0.35)" },
  Volatile: { bg: "var(--chip)", fg: "var(--text-mute)", bd: "var(--border-soft)" },
};

const POSITIONS: PortfolioPosition[] = [
  {
    a: "ETH",
    b: "USDC",
    fee: "0.05%",
    value: "$12,840.20",
    pnl: "+$340.18",
    pct: "+2.71%",
    up: true,
    source: "mantua",
    hook: "Dynamic Fee",
  },
  {
    a: "cbBTC",
    b: "ETH",
    fee: "0.30%",
    value: "$8,210.55",
    pnl: "+$104.40",
    pct: "+1.28%",
    up: true,
    source: "mantua",
    hook: "Dynamic Fee",
  },
  {
    a: "USDC",
    b: "EURC",
    fee: "0.01%",
    value: "$2,104.00",
    pnl: "−$22.10",
    pct: "−1.04%",
    up: false,
    source: "external",
    hook: "Stable Protection",
  },
  {
    a: "ETH",
    b: "EURC",
    fee: "0.01%",
    value: "$540.21",
    pnl: "+$8.40",
    pct: "+1.58%",
    up: true,
    source: "external",
    hook: "Dynamic Fee",
  },
];

const SORTS = ["Descending", "Ascending", "Alphabetical"] as const;
type Sort = (typeof SORTS)[number];

/**
 * Assets card — matches prototype `AssetsCard` in shell.jsx: tabbed
 * Assets / Positions surface. Assets sub-view: search, network + sort
 * filter chips, PnL header, token rows. Positions sub-view (P4e-003):
 * `external` pill on rows whose source !== "mantua". Real balances /
 * positions arrive in Phase 8.
 */
/** Map our `HookName` enum → the legacy `PortfolioPosition.hook`
 *  display label so the existing HOOK_TINT palette keeps working
 *  unchanged when we render local positions. */
function localHookLabel(h: LocalPosition["hook"]): HookName {
  if (!h) return "Volatile";
  if (h === "stable-protection") return "Stable Protection";
  return "Dynamic Fee";
}

function localPositionToRow(p: LocalPosition): PortfolioPosition {
  return {
    a: p.tokenA as AssetSymbol,
    b: p.tokenB as AssetSymbol,
    fee: FEE_TIER_LABELS[p.fee],
    // We don't track running PnL client-side. Show deposited
    // amounts in the value slot so the row stays informative.
    value: `${p.amountA} ${p.tokenA} + ${p.amountB} ${p.tokenB}`,
    pnl: "—",
    pct: "—",
    up: true,
    source: "mantua",
    hook: localHookLabel(p.hook),
    src: p,
  };
}

interface AssetsCardProps {
  /** Navigate to the PoolDetailPage for the clicked LP position.
   *  Called with a `local:` pool id derived from the position's
   *  token pair + fee tier + hook. */
  onSelectPool?: (poolId: string) => void;
  /** Navigate to the AssetDetailPanel for the clicked balance row. */
  onSelectAsset?: (symbol: TokenSymbol) => void;
}

export function AssetsCard({ onSelectPool, onSelectAsset }: AssetsCardProps = {}) {
  const chainId = useCurrentChainId();
  const chainName = CHAIN_INFO[chainId].displayName;
  const [tab, setTab] = useState<"assets" | "positions" | "agent">("assets");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("Descending");
  const [openSort, setOpenSort] = useState(false);
  // Re-read localStorage on each tab change so a fresh mint shows up
  // without a manual page refresh.
  const localPositions = useMemo<LocalPosition[]>(
    () => (IS_MAINNET ? [] : getUserLocalPositions()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab],
  );
  const agentPositions = useMemo<LocalPosition[]>(
    () => (IS_MAINNET ? [] : getAgentLocalPositions()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab],
  );

  const portfolio = usePortfolio();
  const agent = useAgentPortfolio();
  const assets = useMemo<DisplayAsset[]>(() => {
    if (!portfolio.walletAddress) return [];
    return toDisplayAssets(portfolio.balances, chainId);
  }, [portfolio.walletAddress, portfolio.balances, chainId]);
  const agentAssets = useMemo<DisplayAsset[]>(() => {
    if (!agent.agentAddress) return [];
    return toDisplayAssets(agent.balances, chainId);
  }, [agent.agentAddress, agent.balances, chainId]);
  const agentPositionRows = useMemo<PortfolioPosition[]>(
    () => (IS_MAINNET ? [] : agentPositions.map(localPositionToRow)),
    [agentPositions],
  );

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

  // On testnet the LP rows come from our localStorage breadcrumb of
  // freshly-minted positions (Postgres-backed reads are offline in
  // the local dev env). Mainnet keeps the design-source mock until
  // the production positions backend lights up.
  const positionsAvailable = !portfolio.walletAddress
    ? []
    : IS_MAINNET
      ? POSITIONS
      : localPositions.map(localPositionToRow);
  const visiblePositions = positionsAvailable;

  const tabs = [
    { k: "assets" as const, label: "Assets", count: assets.length },
    { k: "positions" as const, label: "Positions", count: positionsAvailable.length },
    {
      k: "agent" as const,
      label: "Agent",
      count: agentAssets.length + agentPositionRows.length,
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
            <button
              type="button"
              className="px-2.5 py-1 rounded-full border border-border bg-bg-elev text-text-dim text-[12px] inline-flex items-center gap-1"
            >
              <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-text-mute">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                </svg>
              </span>
              All networks
              <ChevronDown className="h-3 w-3" />
            </button>
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
                Connect a wallet to see your {chainName} balances.
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
                  No matching balances on {chainName}.
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

      {tab === "positions" && (
        <>
          <div className="max-h-[360px] overflow-auto">
            {!portfolio.walletAddress && (
              <div className="px-4 py-8 text-center text-[12px] text-text-dim">
                Connect a wallet to see your liquidity positions.
              </div>
            )}
            {portfolio.walletAddress && visiblePositions.length === 0 && (
              <div className="px-3.5 py-8 text-center text-[12px] text-text-dim">
                No positions in this view.
              </div>
            )}
            {portfolio.walletAddress &&
              visiblePositions.map((p, i) => {
                const tint = HOOK_TINT[p.hook];
                const handleClick = p.src
                  ? () => {
                      const src = p.src;
                      if (!src) return;
                      const key = localPoolKey(src.chainId, src.tokenA, src.tokenB, src.fee, src.hook);
                      onSelectPool?.(`local:${key}`);
                    }
                  : undefined;
                return (
                  <div
                    key={i}
                    onClick={handleClick}
                    role={handleClick ? "button" : undefined}
                    tabIndex={handleClick ? 0 : undefined}
                    onKeyDown={
                      handleClick
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleClick();
                            }
                          }
                        : undefined
                    }
                    className="flex items-center gap-3 px-4 py-3 border-b border-border-soft cursor-pointer transition-colors hover:bg-row-hover"
                  >
                    <div className="flex flex-shrink-0">
                      <AssetIcon symbol={p.a} size={26} />
                      <div className="-ml-2">
                        <AssetIcon symbol={p.b} size={26} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-[14px]">
                          {p.a} / {p.b}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-chip text-text-mute border border-border-soft font-mono">
                          {p.fee}
                        </span>
                      </div>
                      <div className="mt-1">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium tracking-[0.02em] inline-block"
                          style={{
                            background: tint.bg,
                            color: tint.fg,
                            border: `1px solid ${tint.bd}`,
                          }}
                        >
                          {p.hook}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[14px] font-medium font-mono">{p.value}</div>
                      <div className={`text-[12px] font-mono ${p.up ? "text-green" : "text-red"}`}>
                        {p.pnl} · {p.pct}
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-text-mute" />
                  </div>
                );
              })}
          </div>
        </>
      )}

      {tab === "agent" && (
        <AgentTabBody
          agent={agent}
          agentAssets={agentAssets}
          agentPositionRows={agentPositionRows}
        />
      )}
    </div>
  );
}

function AgentTabBody({
  agent,
  agentAssets,
  agentPositionRows,
}: {
  agent: ReturnType<typeof useAgentPortfolio>;
  agentAssets: DisplayAsset[];
  agentPositionRows: PortfolioPosition[];
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

      <div className="px-3.5 pt-3 pb-1.5 text-[11px] text-text-mute uppercase tracking-wide">
        Balances
      </div>
      {agentAssets.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-text-dim">
          Agent has no balances yet. Send testnet funds to the address above.
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

      <div className="px-3.5 pt-4 pb-1.5 text-[11px] text-text-mute uppercase tracking-wide">
        LP Positions
      </div>
      {agentPositionRows.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-text-dim">
          Agent has no LP positions yet.
        </div>
      ) : (
        agentPositionRows.map((p, i) => {
          const tint = HOOK_TINT[p.hook];
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border-soft">
              <div className="flex flex-shrink-0">
                <AssetIcon symbol={p.a} size={26} />
                <div className="-ml-2">
                  <AssetIcon symbol={p.b} size={26} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-[14px]">
                    {p.a} / {p.b}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-chip text-text-mute border border-border-soft font-mono">
                    {p.fee}
                  </span>
                </div>
                <div className="mt-1">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium tracking-[0.02em] inline-block"
                    style={{
                      background: tint.bg,
                      color: tint.fg,
                      border: `1px solid ${tint.bd}`,
                    }}
                  >
                    {p.hook}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-medium font-mono">{p.value}</div>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}

function shortenAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const KNOWN_ASSETS: AssetSymbol[] = ["ETH", "cbBTC", "USDC", "EURC"];

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

import { useMemo, useRef, useState, useEffect } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { PanelSubHeader } from "@/components/shell/PanelSubHeader.tsx";
import { Button } from "@/components/ui/button.tsx";
import { TokenPairIcon } from "./TokenPairIcon.tsx";
import { usePools } from "./use-pools.ts";
import { formatPct, formatUsd, normalizePairSymbol } from "./format.ts";
import type { PoolSummary } from "./types.ts";

interface Props {
  onSelectPool: (poolId: string) => void;
  onCreate: () => void;
  onClose?: () => void;
}

type Category = "All" | "Stables" | "Majors" | "RWAs" | "Async Limit Order";

const CATEGORIES: Category[] = ["All", "Stables", "Majors", "RWAs", "Async Limit Order"];
const STABLES = new Set(["USDC", "USDT", "DAI", "USDP", "FRAX", "TUSD"]);
const MAJORS = new Set(["ETH", "WETH", "cbBTC", "WBTC", "BTC"]);
const RWAS = new Set(["EURC", "EURS", "AGEUR"]);

interface DerivedPool extends PoolSummary {
  pair: { a: string; b: string };
  category: Exclude<Category, "All">;
  hookLabel: string;
  hasHook: boolean;
}

function classifyPool(p: PoolSummary): DerivedPool {
  const sym = normalizePairSymbol(p.symbol);
  const [aRaw, bRaw] = sym.split("-");
  const a = aRaw ?? "?";
  const b = bRaw ?? "?";
  const aStable = STABLES.has(a);
  const bStable = STABLES.has(b);
  const aMajor = MAJORS.has(a);
  const bMajor = MAJORS.has(b);
  const aRwa = RWAS.has(a);
  const bRwa = RWAS.has(b);
  let category: DerivedPool["category"];
  if (aRwa || bRwa) category = "RWAs";
  else if (aStable && bStable) category = "Stables";
  else if (aMajor || bMajor) category = "Majors";
  else category = "Majors";
  // Hook metadata isn't part of the pool data yet — keep "No Hook" for
  // now; will light up once Mantua-managed pools land in the response.
  const hookLabel = "No Hook";
  return { ...p, pair: { a, b }, category, hookLabel, hasHook: false };
}

/**
 * Pool list — matches `PoolListPanel` in panels.jsx. Chrome: shared
 * `<PanelHeader />` + "Create Pool" subheader (subtitle "Explore and
 * manage your liquidity positions") with close X. Body: 3 stat tiles
 * (TVL/Volume/Fees), search + category filter + primary Create Pool
 * CTA, then pool table with token-pair icons + hook badges.
 */
export function LiquidityListPage({ onSelectPool, onCreate, onClose }: Props) {
  const { data, error, loading } = usePools();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [openCat, setOpenCat] = useState(false);
  const catRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!catRef.current) return;
      if (!catRef.current.contains(e.target as Node)) setOpenCat(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  const enriched = useMemo(() => (data ?? []).map(classifyPool), [data]);

  const totals = useMemo(() => {
    const tvl = enriched.reduce((s, p) => s + (p.tvlUsd || 0), 0);
    const vol = enriched.reduce((s, p) => s + (p.volumeUsd1d || 0), 0);
    // DefiLlama's pool list has no per-pool fee figure; estimate via
    // (volume * fee tier). When the response gains a fees field, use it.
    const fees = enriched.reduce((s, p) => {
      const tierBps = parseFeeTierToBps(p.feeTier);
      return s + ((p.volumeUsd1d || 0) * tierBps) / 10_000;
    }, 0);
    return { tvl, vol, fees };
  }, [enriched]);

  const counts = useMemo(() => {
    const c: Record<Category, number> = {
      All: enriched.length,
      Stables: 0,
      Majors: 0,
      RWAs: 0,
      "Async Limit Order": 0,
    };
    for (const p of enriched) c[p.category] += 1;
    return c;
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (!q) return true;
      const hay = `${p.pair.a} ${p.pair.b} ${p.pair.a}/${p.pair.b} ${p.hookLabel}`.toLowerCase();
      return hay.includes(q);
    });
  }, [enriched, query, category]);

  return (
    <>
      <PanelHeader />
      <PanelSubHeader
        title="Create Pool"
        subtitle="Explore and manage your liquidity positions."
        {...(onClose ? { onClose } : {})}
      />

      <div className="px-5 pt-2 pb-3">
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile label="TVL" value={formatUsd(totals.tvl)} />
          <StatTile label="VOLUME" value={formatUsd(totals.vol)} />
          <StatTile label="FEES" value={formatUsd(totals.fees)} />
        </div>

        <div className="flex gap-2 mt-4 items-center">
          <div className="flex-1 flex items-center gap-2 px-3.5 py-2 bg-bg-elev border border-border-soft rounded-md">
            <Search className="h-3.5 w-3.5 text-text-mute" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="Search pools or hooks..."
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-text"
            />
          </div>

          <div className="relative" ref={catRef}>
            <button
              type="button"
              onClick={() => {
                setOpenCat((v) => !v);
              }}
              className="px-3 py-2 rounded-md bg-bg-elev border border-border-soft text-[13px] text-text inline-flex items-center gap-1.5 cursor-pointer"
            >
              {category}
              <ChevronDown className="h-3 w-3" />
            </button>
            {openCat && (
              <div className="absolute right-0 top-full mt-1 z-30 min-w-[170px] bg-panel-solid border border-border rounded-md p-1 shadow-xl">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCategory(c);
                      setOpenCat(false);
                    }}
                    className={`flex items-center justify-between w-full px-2.5 py-2 rounded-xs text-left text-[13px] cursor-pointer ${
                      category === c
                        ? "bg-chip text-text"
                        : "bg-transparent text-text hover:bg-row-hover"
                    }`}
                  >
                    <span>{c}</span>
                    <span className="text-[11px] text-text-mute">{counts[c]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button variant="primary" size="md" onClick={onCreate}>
            <Plus className="h-3.5 w-3.5" /> Create Pool
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 px-5 pb-2">
        {loading && (
          <p className="px-1 py-8 text-xs text-text-dim text-center">Loading pools…</p>
        )}
        {error && (
          <p className="px-1 py-8 text-xs text-red text-center">
            Failed to load pools: {error.message}
          </p>
        )}
        {!loading && !error && filtered.length === 0 && (
          <p className="px-1 py-8 text-xs text-text-dim text-center">No pools match your search.</p>
        )}

        {filtered.length > 0 && (
          <>
            <div className="grid grid-cols-[1.6fr_1fr_1fr_0.9fr_0.6fr] gap-3 py-2 text-[10px] uppercase tracking-wider text-text-mute border-b border-border-soft">
              <span>Pool</span>
              <span className="text-right">TVL ↓</span>
              <span className="text-right">Volume (24H)</span>
              <span className="text-right">Fees (24H)</span>
              <span className="text-right">APR</span>
            </div>
            <ul className="flex-1 overflow-auto">
              {filtered.slice(0, 50).map((p) => (
                <PoolRow key={p.id} pool={p} onSelect={onSelectPool} />
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-elev border border-border-soft rounded-md px-3.5 py-3">
      <div className="text-[11px] uppercase tracking-[0.08em] text-text-mute">{label}</div>
      <div className="text-[22px] font-semibold mt-1 -tracking-[0.01em] font-mono">{value}</div>
    </div>
  );
}

function PoolRow({ pool, onSelect }: { pool: DerivedPool; onSelect: (id: string) => void }) {
  const tier = pool.feeTier ?? "—";
  const tierBps = parseFeeTierToBps(pool.feeTier);
  const fees24 = ((pool.volumeUsd1d || 0) * tierBps) / 10_000;
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onSelect(pool.id);
        }}
        className="grid grid-cols-[1.6fr_1fr_1fr_0.9fr_0.6fr] gap-3 items-center w-full py-3 hover:bg-row-hover transition-colors text-left border-b border-border-soft cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <TokenPairIcon a={pool.pair.a} b={pool.pair.b} size={22} />
          <div className="min-w-0">
            <div className="text-[13px] font-medium">
              {pool.pair.a} / {pool.pair.b}
            </div>
            <div className="text-[11px] text-text-mute mt-0.5 flex items-center gap-1.5">
              <span>{tier}</span>
              <HookBadge hasHook={pool.hasHook} label={pool.hookLabel} />
            </div>
          </div>
        </div>
        <span className="text-[13px] font-mono text-right">{formatUsd(pool.tvlUsd)}</span>
        <span className="text-[13px] font-mono text-right">{formatUsd(pool.volumeUsd1d)}</span>
        <span className="text-[13px] font-mono text-right">{formatUsd(fees24)}</span>
        <span className="text-[13px] font-mono text-right text-green">
          {formatPct(pool.apy)}
        </span>
      </button>
    </li>
  );
}

function HookBadge({ hasHook, label }: { hasHook: boolean; label: string }) {
  if (hasHook) {
    return (
      <span
        className="px-1.5 py-px rounded-[6px] text-[10px] font-semibold tracking-[0.01em] border"
        style={{
          background: "rgba(61, 220, 151, 0.14)",
          color: "var(--green)",
          borderColor: "rgba(61, 220, 151, 0.35)",
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <span className="px-1.5 py-px rounded-[6px] text-[10px] font-medium tracking-[0.01em] bg-chip text-text-mute border border-border-soft">
      {label}
    </span>
  );
}

function parseFeeTierToBps(feeTier: string | null): number {
  if (!feeTier) return 0;
  const m = /([\d.]+)\s*%/.exec(feeTier);
  if (!m || m[1] === undefined) return 0;
  const pct = parseFloat(m[1]);
  if (!Number.isFinite(pct)) return 0;
  return Math.round(pct * 100);
}

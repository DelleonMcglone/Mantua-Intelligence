import { useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { AssetIcon, type AssetSymbol } from "./asset-icons.tsx";

interface Asset {
  sym: AssetSymbol;
  name: string;
  price: string;
  pct: number;
  qty: string;
  val: string;
}

const ASSETS: Asset[] = [
  { sym: "ETH", name: "Ethereum", price: "$3,630.12", pct: -0.75, qty: "7.01", val: "$25,385.54" },
  {
    sym: "cbBTC",
    name: "Coinbase Wrapped BTC",
    price: "$67,224.32",
    pct: 0.31,
    qty: "0.22",
    val: "$14,234.40",
  },
  { sym: "USDC", name: "USD Coin", price: "$1.00", pct: 0.0, qty: "7,292.36", val: "$7,292.38" },
  { sym: "EURC", name: "Euro Coin", price: "$1.08", pct: 0.12, qty: "1,250.00", val: "$1,350.00" },
];

interface PortfolioPosition {
  a: AssetSymbol;
  b: AssetSymbol;
  fee: string;
  value: string;
  pnl: string;
  pct: string;
  up: boolean;
  source: "mantua" | "external";
}

const POSITIONS: PortfolioPosition[] = [
  { a: "ETH", b: "USDC", fee: "0.05%", value: "$12,840.20", pnl: "+$340.18", pct: "+2.71%", up: true, source: "mantua" },
  { a: "cbBTC", b: "ETH", fee: "0.30%", value: "$8,210.55", pnl: "+$104.40", pct: "+1.28%", up: true, source: "mantua" },
  { a: "USDC", b: "EURC", fee: "0.01%", value: "$2,104.00", pnl: "−$22.10", pct: "−1.04%", up: false, source: "external" },
  { a: "ETH", b: "EURC", fee: "0.01%", value: "$540.21", pnl: "+$8.40", pct: "+1.58%", up: true, source: "external" },
];

const SORTS = ["Descending", "Ascending", "Alphabetical"] as const;
type Sort = (typeof SORTS)[number];

/**
 * Assets card — matches prototype `AssetsCard` in shell.jsx: tabbed
 * Assets / Positions surface. Assets sub-view: search, network + sort
 * filter chips, PnL header, token rows. Positions sub-view (P4e-003):
 * source filter strip ("All wallet positions" / "Opened in Mantua") +
 * `external` pill on rows whose source !== "mantua". Real balances /
 * positions arrive in Phase 8.
 */
export function AssetsCard() {
  const [tab, setTab] = useState<"assets" | "positions">("assets");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("Descending");
  const [openSort, setOpenSort] = useState(false);
  const [posSource, setPosSource] = useState<"all" | "mantua">("all");

  const numVal = (s: string) => Number(s.replace(/[^\d.-]/g, "")) || 0;
  const filtered = ASSETS.filter(
    (a) =>
      !q ||
      a.sym.toLowerCase().includes(q.toLowerCase()) ||
      a.name.toLowerCase().includes(q.toLowerCase()),
  )
    .slice()
    .sort((a, b) => {
      if (sort === "Alphabetical") return a.name.localeCompare(b.name);
      if (sort === "Ascending") return numVal(a.val) - numVal(b.val);
      return numVal(b.val) - numVal(a.val);
    });

  const visiblePositions =
    posSource === "mantua" ? POSITIONS.filter((p) => p.source === "mantua") : POSITIONS;
  const mantuaCount = POSITIONS.filter((p) => p.source === "mantua").length;

  const tabs = [
    { k: "assets" as const, label: "Assets", count: ASSETS.length },
    { k: "positions" as const, label: "Positions", count: POSITIONS.length },
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
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
        {filtered.map((a) => (
          <div
            key={a.sym}
            className="flex items-center gap-3 px-4 py-3 border-b border-border-soft cursor-pointer transition-colors hover:bg-row-hover"
          >
            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 flex">
              <AssetIcon symbol={a.sym} size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-[14px]">{a.name}</span>
                <span className={`text-[12px] ${a.pct >= 0 ? "text-green" : "text-red"}`}>
                  {a.pct >= 0 ? "↗" : "↘"} {Math.abs(a.pct).toFixed(2)}%
                </span>
              </div>
              <div className="text-[12px] text-text-dim mt-0.5">
                {a.sym} · {a.price}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[14px] font-medium">{a.qty}</div>
              <div className="text-[12px] text-text-dim">{a.val}</div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-text-mute" />
          </div>
        ))}
      </div>
        </>
      )}

      {tab === "positions" && (
        <>
          <div className="px-3.5 py-2.5 border-b border-border-soft flex items-center gap-1.5">
            <span className="text-[11px] text-text-mute mr-0.5">Show</span>
            {(
              [
                { k: "all", label: "All wallet positions", count: POSITIONS.length },
                { k: "mantua", label: "Opened in Mantua", count: mantuaCount },
              ] as const
            ).map((o) => {
              const active = posSource === o.k;
              return (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => {
                    setPosSource(o.k);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] cursor-pointer inline-flex items-center gap-1 ${
                    active
                      ? "bg-text text-bg border border-text"
                      : "bg-bg-elev text-text-dim border border-border-soft"
                  }`}
                >
                  {o.label}
                  <span className="text-[10px] font-mono opacity-70">{o.count}</span>
                </button>
              );
            })}
          </div>

          {posSource === "mantua" && (
            <div className="px-3.5 py-2 text-[11px] text-text-mute border-b border-border-soft flex items-center gap-1.5">
              Showing positions opened in Mantua.
              <span className="border-b border-dotted border-text-mute cursor-pointer">
                External positions coming soon
              </span>
            </div>
          )}

          <div className="max-h-[360px] overflow-auto">
            {visiblePositions.length === 0 && (
              <div className="px-3.5 py-8 text-center text-[12px] text-text-dim">
                No positions in this view.
              </div>
            )}
            {visiblePositions.map((p, i) => (
              <div
                key={i}
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
                    {p.source === "external" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono tracking-wider bg-[rgba(139,108,240,0.12)] text-accent border border-[rgba(139,108,240,0.35)]">
                        external
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-text-dim mt-0.5">LP position</div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-medium font-mono">{p.value}</div>
                  <div className={`text-[12px] font-mono ${p.up ? "text-green" : "text-red"}`}>
                    {p.pnl} · {p.pct}
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-text-mute" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

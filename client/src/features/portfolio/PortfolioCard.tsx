import { useMemo, useState } from "react";

const RANGES = ["1H", "1D", "TW", "1M", "1Y"] as const;
type Range = (typeof RANGES)[number];

const POINTS_BY_RANGE: Record<Range, number> = {
  "1H": 80,
  "1D": 100,
  TW: 150,
  "1M": 200,
  "1Y": 260,
};

/**
 * Portfolio card — matches prototype `PortfolioCard` in shell.jsx:
 * total value + week delta + amber line chart with dotted background +
 * range pills (1H/1D/TW/1M/1Y) and Live indicator. Chart shape is a
 * deterministic synthetic series (sharp early dip → climb → mid pullback
 * → final peak) keyed by the selected range. Real wallet balances
 * arrive in Phase 8.
 */
export function PortfolioCard() {
  const [range, setRange] = useState<Range>("TW");
  const points = useMemo(() => generateSeries(POINTS_BY_RANGE[range]), [range]);

  const w = 560;
  const h = 170;
  const pad = 8;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const sx = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const sy = (v: number) => pad + (1 - (v - min) / (max - min + 0.001)) * (h - pad * 2);
  const path = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`)
    .join(" ");
  const area = `${path} L${String(sx(points.length - 1))},${String(h - pad)} L${String(sx(0))},${String(h - pad)} Z`;

  return (
    <div
      className="bg-panel-solid border border-border-soft rounded-md transition-colors"
      style={{ padding: "calc(18px * var(--density))" }}
    >
      <div className="text-center pt-[18px]">
        <div className="text-[13px] text-text-dim">Portfolio</div>
        <div className="text-[34px] font-semibold mt-0.5 -tracking-[0.02em]">$72,697.83</div>
        <div className="text-[13px] text-green mt-0.5">
          <span className="mr-1">↗</span>3.51% past week
        </div>
      </div>
      <div className="relative mt-2">
        <svg viewBox={`0 0 ${String(w)} ${String(h)}`} width="100%" className="block">
          <defs>
            <linearGradient id="amberFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--amber)" stopOpacity="0.25" />
              <stop offset="1" stopColor="var(--amber)" stopOpacity="0" />
            </linearGradient>
            <pattern id="dotPat" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r=".8" fill="var(--amber)" opacity=".18" />
            </pattern>
          </defs>
          <rect x="0" y={h * 0.45} width={w} height={h * 0.55} fill="url(#dotPat)" />
          <path d={area} fill="url(#amberFill)" />
          <path
            d={path}
            fill="none"
            stroke="var(--amber)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="flex justify-center gap-0.5 mt-1 items-center">
          <div className="inline-flex bg-bg-elev rounded-full p-[3px] border border-border-soft">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRange(r);
                }}
                className={`px-2.5 py-1 rounded-full border-none text-[12px] font-medium cursor-pointer transition-colors ${
                  range === r ? "bg-chip text-text" : "bg-transparent text-text-dim"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="ml-3 flex items-center gap-1.5 text-text-dim text-[12px]">
            <span
              className="w-1.5 h-1.5 rounded-full bg-green"
              style={{ boxShadow: "0 0 8px var(--green)" }}
            />
            Live
          </div>
        </div>
      </div>
    </div>
  );
}

function generateSeries(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let v = 58 + t * 36;
    v -= 48 * Math.exp(-Math.pow((t - 0.09) / 0.045, 2));
    v -= 6 * Math.exp(-Math.pow((t - 0.42) / 0.05, 2));
    v -= 8 * Math.exp(-Math.pow((t - 0.62) / 0.06, 2));
    v += 6 * Math.exp(-Math.pow((t - 0.78) / 0.04, 2));
    v += Math.sin(t * 22) * 2.2 + Math.cos(t * 41) * 1.3 + Math.sin(t * 70) * 0.8;
    out.push(v);
  }
  return out;
}

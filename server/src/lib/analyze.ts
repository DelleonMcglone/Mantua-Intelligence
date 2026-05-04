import { z } from "zod";
import { listBasePools } from "./defillama.ts";
import { logger } from "./logger.ts";

/**
 * POC analyze engine. Each topic is a one-shot fetcher that turns
 * external data (CoinGecko, DefiLlama, plus a sprinkling of static
 * content for the educational topic) into a generic
 * `AnalyzeResponse` so the client can render it without per-topic
 * branching. Bigger plans (full agentic research, charts, etc.) live
 * downstream — this is the "answer the suggestion buttons with real
 * data" pass the user explicitly asked for.
 */

const COINGECKO = "https://api.coingecko.com/api/v3";

export const TOPICS = [
  "eth-price",
  "eurc-peg",
  "usdc-usdt-pool",
  "top-rwa-tokens",
  "cbbtc-24h-volume",
  "mantua-hooks",
] as const;
export type Topic = (typeof TOPICS)[number];
export const topicSchema = z.enum(TOPICS);

export interface AnalyzeMetric {
  label: string;
  value: string;
  hint?: string;
}

export interface AnalyzeSource {
  name: string;
  url?: string;
}

export interface AnalyzeResponse {
  topic: Topic;
  title: string;
  summary: string;
  metrics?: AnalyzeMetric[];
  bullets?: string[];
  sources?: AnalyzeSource[];
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

function fmtPct(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(dp)}%`;
}

const ethPriceSchema = z.object({
  ethereum: z.object({
    usd: z.number(),
    usd_24h_change: z.number().optional(),
  }),
});

async function ethPrice(): Promise<AnalyzeResponse> {
  const url = `${COINGECKO}/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`CoinGecko ${String(res.status)}`);
  const json = ethPriceSchema.parse(await res.json());
  const change = json.ethereum.usd_24h_change ?? 0;
  return {
    topic: "eth-price",
    title: "ETH spot price",
    summary: `Ethereum is trading at ${fmtUsd(json.ethereum.usd)} per ETH${
      Number.isFinite(change) ? `, ${fmtPct(change)} in the last 24h` : ""
    }.`,
    metrics: [
      { label: "Price", value: fmtUsd(json.ethereum.usd) },
      { label: "24h change", value: fmtPct(change) },
    ],
    sources: [{ name: "CoinGecko", url: "https://www.coingecko.com/en/coins/ethereum" }],
  };
}

const eurcDualSchema = z.object({
  "euro-coin": z.object({ usd: z.number(), eur: z.number().optional() }),
});

async function eurcPeg(): Promise<AnalyzeResponse> {
  // Pull EURC priced in BOTH usd and eur from CoinGecko. EURC's
  // intended peg is 1:1 EURC↔EUR fiat (Circle's mint contract). The
  // EUR-denominated price tells us the peg directly without needing a
  // hardcoded EUR/USD reference: a healthy peg is `eur ≈ 1.0`. The
  // USD-denominated price is shown for context.
  const url = `${COINGECKO}/simple/price?ids=euro-coin&vs_currencies=usd,eur`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`CoinGecko ${String(res.status)}`);
  const json = eurcDualSchema.parse(await res.json());
  const usd = json["euro-coin"].usd;
  const eur = json["euro-coin"].eur ?? 1;
  const dev = (eur - 1) * 100;
  let zone: "ON_PEG" | "WARN" | "STRESS";
  if (Math.abs(dev) < 0.5) zone = "ON_PEG";
  else if (Math.abs(dev) < 2) zone = "WARN";
  else zone = "STRESS";
  return {
    topic: "eurc-peg",
    title: "EURC peg status",
    summary:
      zone === "ON_PEG"
        ? `EURC is trading at €${eur.toFixed(4)} — within ±0.5% of its 1:1 EUR peg (currently $${usd.toFixed(4)} per EURC).`
        : zone === "WARN"
          ? `EURC is at €${eur.toFixed(4)} (${fmtPct(dev)} off peg). Slightly outside the tight ±0.5% band; worth keeping an eye on. USD spot: $${usd.toFixed(4)}.`
          : `EURC is at €${eur.toFixed(4)} (${fmtPct(dev)} off peg). Outside the ±2% band — Stable Protection would flag this as STRESS. USD spot: $${usd.toFixed(4)}.`,
    metrics: [
      { label: "EURC vs EUR", value: `€${eur.toFixed(4)}` },
      { label: "EURC vs USD", value: `$${usd.toFixed(4)}` },
      { label: "Peg deviation", value: fmtPct(dev) },
      { label: "Zone", value: zone },
    ],
    sources: [
      { name: "CoinGecko", url: "https://www.coingecko.com/en/coins/euro-coin" },
      { name: "Circle EURC", url: "https://www.circle.com/eurc" },
    ],
  };
}

async function usdcUsdtPool(): Promise<AnalyzeResponse> {
  const all = await listBasePools();
  const candidates = all.filter((p) => /USDC.*USDT|USDT.*USDC/i.test(p.symbol));
  if (candidates.length === 0) {
    return {
      topic: "usdc-usdt-pool",
      title: "USDC/USDT pool health",
      summary:
        "DefiLlama doesn't currently surface a USDC/USDT pool on Base. On Base, USDC pairs typically route against ETH or cbBTC; USDT volume is concentrated on Ethereum L1 and Arbitrum.",
      sources: [{ name: "DefiLlama (Base pools)", url: "https://defillama.com/yields?chain=Base" }],
    };
  }
  const top = candidates.sort((a, b) => b.tvlUsd - a.tvlUsd)[0]!;
  return {
    topic: "usdc-usdt-pool",
    title: "USDC/USDT — top Base pool",
    summary: `The deepest USDC/USDT pool on Base sits in ${top.project} with ${fmtUsd(top.tvlUsd)} TVL${
      top.poolMeta ? ` (fee tier ${top.poolMeta})` : ""
    }. ${
      top.apy && top.apy > 0
        ? `Current APY is ~${top.apy.toFixed(2)}%.`
        : "Yield is currently negligible (mostly volume-driven)."
    }`,
    metrics: [
      { label: "Project", value: top.project },
      { label: "TVL", value: fmtUsd(top.tvlUsd) },
      { label: "Volume (24h)", value: fmtUsd(top.volumeUsd1d ?? 0) },
      { label: "APY", value: top.apy ? `${top.apy.toFixed(2)}%` : "—" },
    ],
    sources: [{ name: "DefiLlama", url: `https://defillama.com/yields/pool/${top.pool}` }],
  };
}

async function cbbtc24hVolume(): Promise<AnalyzeResponse> {
  const all = await listBasePools();
  const cbbtcPools = all.filter((p) => /cbBTC/i.test(p.symbol));
  if (cbbtcPools.length === 0) {
    return {
      topic: "cbbtc-24h-volume",
      title: "cbBTC volume on Base",
      summary:
        "DefiLlama doesn't currently surface cbBTC pools on Base. cbBTC was minted on Base in 2024; once liquidity migrates onto v3/v4 pools the route returns real numbers here.",
      sources: [
        { name: "DefiLlama (Base pools)", url: "https://defillama.com/yields?chain=Base" },
      ],
    };
  }
  const total24h = cbbtcPools.reduce((s, p) => s + (p.volumeUsd1d ?? 0), 0);
  const total7d = cbbtcPools.reduce((s, p) => s + (p.volumeUsd7d ?? 0), 0);
  const avgDaily7d = total7d / 7;
  const trend =
    avgDaily7d > 0 ? ((total24h - avgDaily7d) / avgDaily7d) * 100 : 0;
  const top = cbbtcPools.sort(
    (a, b) => (b.volumeUsd1d ?? 0) - (a.volumeUsd1d ?? 0),
  )[0]!;
  return {
    topic: "cbbtc-24h-volume",
    title: "cbBTC — 24h volume on Base",
    summary: `Across ${String(cbbtcPools.length)} cbBTC pools on Base, ${fmtUsd(total24h)} of volume cleared in the last 24h${
      Number.isFinite(trend)
        ? ` (${fmtPct(trend)} vs the trailing 7-day daily average)`
        : ""
    }. Largest single pool: ${top.project} ${top.symbol} at ${fmtUsd(top.volumeUsd1d ?? 0)}.`,
    metrics: [
      { label: "24h volume (total)", value: fmtUsd(total24h) },
      { label: "7d daily avg", value: fmtUsd(avgDaily7d) },
      { label: "Trend vs 7d avg", value: fmtPct(trend) },
      { label: "Top pool", value: `${top.project} (${fmtUsd(top.volumeUsd1d ?? 0)})` },
    ],
    sources: [
      { name: "DefiLlama (Base cbBTC pools)", url: "https://defillama.com/yields?chain=Base&token=CBBTC" },
    ],
  };
}

const RWA_LIST: { symbol: string; name: string; coingeckoId: string; venue: string }[] = [
  { symbol: "MKR", name: "MakerDAO", coingeckoId: "maker", venue: "Ethereum L1" },
  { symbol: "ONDO", name: "Ondo Finance", coingeckoId: "ondo-finance", venue: "Ethereum L1 / Arbitrum" },
  { symbol: "PENDLE", name: "Pendle", coingeckoId: "pendle", venue: "Ethereum L1 / Arbitrum" },
  { symbol: "RWA", name: "Centrifuge", coingeckoId: "centrifuge", venue: "Ethereum L1" },
  { symbol: "POLYX", name: "Polymesh", coingeckoId: "polymesh", venue: "Polymesh" },
];

const rwaPriceSchema = z.record(
  z.string(),
  z.object({
    usd: z.number().optional(),
    usd_24h_change: z.number().optional(),
  }),
);

async function topRwaTokens(): Promise<AnalyzeResponse> {
  const ids = RWA_LIST.map((t) => t.coingeckoId).join(",");
  const url = `${COINGECKO}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`CoinGecko ${String(res.status)}`);
  const json = rwaPriceSchema.parse(await res.json());
  const rows = RWA_LIST.map((t) => {
    const p = json[t.coingeckoId];
    return {
      ...t,
      price: p?.usd ?? 0,
      change: p?.usd_24h_change ?? 0,
    };
  })
    .filter((r) => r.price > 0)
    .sort((a, b) => b.change - a.change);
  if (rows.length === 0) {
    return {
      topic: "top-rwa-tokens",
      title: "Top RWA tokens",
      summary:
        "Couldn't pull live prices right now (CoinGecko rate limit). Try again in a minute.",
      sources: [{ name: "CoinGecko" }],
    };
  }
  const winner = rows[0]!;
  return {
    topic: "top-rwa-tokens",
    title: "Top performing RWA tokens (24h)",
    summary: `Across the major RWA names, ${winner.name} (${winner.symbol}) leads the day at ${fmtPct(winner.change)}. Sorted by 24h change:`,
    metrics: rows.map((r) => ({
      label: `${r.symbol} (${r.venue})`,
      value: `${fmtUsd(r.price)} · ${fmtPct(r.change)}`,
    })),
    sources: [{ name: "CoinGecko", url: "https://www.coingecko.com/en/categories/real-world-assets-rwa" }],
  };
}

function mantuaHooks(): AnalyzeResponse {
  return {
    topic: "mantua-hooks",
    title: "Mantua hooks",
    summary:
      "Mantua's four Liquidity Hooks plug into Uniswap v4's pool lifecycle to add behavior that vanilla pools can't: dynamic fees, peg protection, KYC gating, and async limit orders.",
    bullets: [
      "Dynamic Fee — adjusts the per-swap fee on every trade based on a TWAP-derived volatility signal. Rewards LPs more during turbulence; cheaper for stable flow.",
      "Stable Protection — peg-zone-aware pool. Reads virtual reserves at every swap, classifies HEALTHY / WARN / STRESS / CRITICAL, and blocks or surcharges trades to keep the pool from draining during depegs.",
      "RWAgate — compliance-gated routing. Verifies the swapper's address is in an approved registry before allowing a swap or liquidity operation. Lets institutions plug RWA pools into permissionless DEXes safely.",
      "Async Limit Order — off-chain order matching with on-chain settlement. Lets a relayer fill exact-output orders against the pool when the price hits, with `BEFORE_SWAP_RETURNS_DELTA` for fee parity.",
    ],
    sources: [
      { name: "Uniswap v4 Hooks", url: "https://docs.uniswap.org/contracts/v4/concepts/hooks" },
    ],
  };
}

const TOPIC_RUNNERS: Record<Topic, () => Promise<AnalyzeResponse> | AnalyzeResponse> = {
  "eth-price": ethPrice,
  "eurc-peg": eurcPeg,
  "usdc-usdt-pool": usdcUsdtPool,
  "top-rwa-tokens": topRwaTokens,
  "cbbtc-24h-volume": cbbtc24hVolume,
  "mantua-hooks": mantuaHooks,
};

export async function runAnalyze(topic: Topic): Promise<AnalyzeResponse> {
  try {
    return await TOPIC_RUNNERS[topic]();
  } catch (err) {
    logger.warn({ err, topic }, "analyze topic failed");
    throw err;
  }
}

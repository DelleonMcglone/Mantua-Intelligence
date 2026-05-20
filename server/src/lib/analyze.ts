import { listBasePools, getTokenPrices, getTokenChangePercents } from "./defillama.ts";
import { logger } from "./logger.ts";
import { z } from "zod";

/**
 * POC analyze engine. Each topic is a one-shot fetcher that turns
 * external data (DefiLlama Coins for spot/change, DefiLlama Yields for
 * pool stats, plus a sprinkling of static content for the educational
 * topic) into a generic `AnalyzeResponse` so the client can render it
 * without per-topic branching. Bigger plans (full agentic research,
 * charts, etc.) live downstream — this is the "answer the suggestion
 * buttons with real data" pass the user explicitly asked for.
 *
 * Spot prices route through DefiLlama Coins (`coins.llama.fi`) — the
 * free tier is open and rate-limit-friendly, vs. CoinGecko's anonymous
 * free tier which throttles at ~5–15 req/min per source IP. DefiLlama
 * keys the same prices we want by `coingecko:<id>`, so the existing
 * alias map drives both sources.
 */

export const TOPICS = [
  "eth-price",
  "eurc-peg",
  "usdc-eurc-pool",
  "top-stablecoins",
  "usdc-24h-volume",
  "mantua-hooks",
  // Generic price lookup — uses the `?symbol=` query param (or the
  // `symbol` body field) to drive a CoinGecko spot fetch. Falls back
  // to a "we don't know that symbol" message when the symbol isn't in
  // our small alias map.
  "token-price",
] as const;
export type Topic = (typeof TOPICS)[number];
export const topicSchema = z.enum(TOPICS);

/**
 * Map common natural-language token names to CoinGecko ids and
 * display labels. Kept as a flat array (not a record) so the order
 * of matching is deterministic — longer aliases first to avoid
 * "btc" cannibalizing "cbbtc" before the cb prefix is checked.
 */
const TOKEN_ALIASES: { aliases: string[]; coingeckoId: string; label: string; symbol: string }[] = [
  { aliases: ["coinbase wrapped btc", "cbbtc", "cb-btc"], coingeckoId: "coinbase-wrapped-btc", label: "Coinbase Wrapped BTC", symbol: "cbBTC" },
  { aliases: ["bitcoin", "btc"], coingeckoId: "bitcoin", label: "Bitcoin", symbol: "BTC" },
  { aliases: ["ethereum", "eth"], coingeckoId: "ethereum", label: "Ethereum", symbol: "ETH" },
  { aliases: ["solana", "sol"], coingeckoId: "solana", label: "Solana", symbol: "SOL" },
  { aliases: ["usd coin", "usdc"], coingeckoId: "usd-coin", label: "USD Coin", symbol: "USDC" },
  { aliases: ["tether", "usdt"], coingeckoId: "tether", label: "Tether", symbol: "USDT" },
  { aliases: ["euro coin", "eurc"], coingeckoId: "euro-coin", label: "Euro Coin", symbol: "EURC" },
  { aliases: ["wrapped ether", "weth"], coingeckoId: "weth", label: "Wrapped Ether", symbol: "WETH" },
  { aliases: ["maker", "mkr"], coingeckoId: "maker", label: "Maker", symbol: "MKR" },
  { aliases: ["pendle"], coingeckoId: "pendle", label: "Pendle", symbol: "PENDLE" },
  { aliases: ["ondo"], coingeckoId: "ondo-finance", label: "Ondo", symbol: "ONDO" },
  { aliases: ["centrifuge", "rwa"], coingeckoId: "centrifuge", label: "Centrifuge", symbol: "CFG" },
];

export function resolveTokenAlias(input: string): { coingeckoId: string; label: string; symbol: string } | null {
  const norm = input.trim().toLowerCase();
  if (!norm) return null;
  for (const t of TOKEN_ALIASES) {
    if (t.aliases.includes(norm)) return t;
  }
  return null;
}

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

async function ethPrice(): Promise<AnalyzeResponse> {
  const [prices, changes] = await Promise.all([
    getTokenPrices(["coingecko:ethereum"]),
    getTokenChangePercents(["coingecko:ethereum"]),
  ]);
  const price = prices["coingecko:ethereum"]?.price;
  if (price === undefined) throw new Error("DefiLlama: ETH price unavailable");
  const change = changes["coingecko:ethereum"] ?? 0;
  return {
    topic: "eth-price",
    title: "ETH spot price",
    summary: `Ethereum is trading at ${fmtUsd(price)} per ETH${
      Number.isFinite(change) ? `, ${fmtPct(change)} in the last 24h` : ""
    }.`,
    metrics: [
      { label: "Price", value: fmtUsd(price) },
      { label: "24h change", value: fmtPct(change) },
    ],
    sources: [{ name: "DefiLlama", url: "https://defillama.com/coins/coingecko:ethereum" }],
  };
}

async function eurcPeg(): Promise<AnalyzeResponse> {
  // DefiLlama's price API returns USD only (no `vs_currency=eur`
  // equivalent), so the EUR reference for peg-deviation comes from
  // agEUR — another EUR-pegged stablecoin (`coingecko:ageur`). Cross
  // both USD prices to get an implied EURC/EUR rate without an FX feed.
  //   peg_ratio  = EURC_usd / agEUR_usd   (should be ≈ 1.0 on-peg)
  //   deviation% = (peg_ratio - 1) * 100
  // Tether-EURT was rejected as a reference (price ≈ $0.07, broken).
  const prices = await getTokenPrices(["coingecko:euro-coin", "coingecko:ageur"]);
  const eurcUsd = prices["coingecko:euro-coin"]?.price;
  const eurRef = prices["coingecko:ageur"]?.price;
  if (eurcUsd === undefined || eurRef === undefined || eurRef === 0) {
    throw new Error("DefiLlama: EURC or agEUR price unavailable");
  }
  const pegRatio = eurcUsd / eurRef;
  const dev = (pegRatio - 1) * 100;
  let zone: "ON_PEG" | "WARN" | "STRESS";
  if (Math.abs(dev) < 0.5) zone = "ON_PEG";
  else if (Math.abs(dev) < 2) zone = "WARN";
  else zone = "STRESS";
  return {
    topic: "eurc-peg",
    title: "EURC peg status",
    summary:
      zone === "ON_PEG"
        ? `EURC is trading at $${eurcUsd.toFixed(4)} vs the EUR reference of $${eurRef.toFixed(4)} (agEUR). Within ±0.5% of the 1:1 EUR peg.`
        : zone === "WARN"
          ? `EURC at $${eurcUsd.toFixed(4)} vs EUR reference $${eurRef.toFixed(4)} (agEUR) — peg ratio ${pegRatio.toFixed(4)} (${fmtPct(dev)} off). Slightly outside the tight ±0.5% band.`
          : `EURC at $${eurcUsd.toFixed(4)} vs EUR reference $${eurRef.toFixed(4)} (agEUR) — peg ratio ${pegRatio.toFixed(4)} (${fmtPct(dev)} off). Outside the ±2% band; Stable Protection would flag STRESS.`,
    metrics: [
      { label: "EURC (USD)", value: `$${eurcUsd.toFixed(4)}` },
      { label: "EUR reference (agEUR)", value: `$${eurRef.toFixed(4)}` },
      { label: "Implied peg", value: pegRatio.toFixed(4) },
      { label: "Peg deviation", value: fmtPct(dev) },
      { label: "Zone", value: zone },
    ],
    sources: [
      { name: "DefiLlama (EURC)", url: "https://defillama.com/coins/coingecko:euro-coin" },
      { name: "DefiLlama (agEUR)", url: "https://defillama.com/coins/coingecko:ageur" },
      { name: "Circle EURC", url: "https://www.circle.com/eurc" },
    ],
  };
}

async function usdcEurcPool(): Promise<AnalyzeResponse> {
  const all = await listBasePools();
  const candidates = all.filter((p) => /USDC.*EURC|EURC.*USDC/i.test(p.symbol));
  if (candidates.length === 0) {
    return {
      topic: "usdc-eurc-pool",
      title: "USDC/EURC pool health",
      summary:
        "DefiLlama doesn't currently surface a USDC/EURC pool on Base. USDC/EURC is the marquee pair for Mantua's Stable Protection hook (dynamic fees scale across five depeg zones) — once external liquidity migrates onto a v4 pool with the hook attached, this route surfaces live TVL/APY here.",
      sources: [{ name: "DefiLlama (Base pools)", url: "https://defillama.com/yields?chain=Base" }],
    };
  }
  const top = candidates.sort((a, b) => b.tvlUsd - a.tvlUsd)[0]!;
  return {
    topic: "usdc-eurc-pool",
    title: "USDC/EURC — top Base pool",
    summary: `The deepest USDC/EURC pool on Base sits in ${top.project} with ${fmtUsd(top.tvlUsd)} TVL${
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

async function usdc24hVolume(): Promise<AnalyzeResponse> {
  const all = await listBasePools();
  const usdcPools = all.filter((p) => /\bUSDC\b/i.test(p.symbol));
  if (usdcPools.length === 0) {
    return {
      topic: "usdc-24h-volume",
      title: "USDC volume on Base",
      summary:
        "DefiLlama isn't returning USDC pools on Base right now. USDC is the canonical Base stablecoin (Circle-native); transient API hiccup is the most likely cause — try again in a moment.",
      sources: [
        { name: "DefiLlama (Base pools)", url: "https://defillama.com/yields?chain=Base" },
      ],
    };
  }
  const total24h = usdcPools.reduce((s, p) => s + (p.volumeUsd1d ?? 0), 0);
  const total7d = usdcPools.reduce((s, p) => s + (p.volumeUsd7d ?? 0), 0);
  const avgDaily7d = total7d / 7;
  const trend =
    avgDaily7d > 0 ? ((total24h - avgDaily7d) / avgDaily7d) * 100 : 0;
  const top = usdcPools.sort(
    (a, b) => (b.volumeUsd1d ?? 0) - (a.volumeUsd1d ?? 0),
  )[0]!;
  return {
    topic: "usdc-24h-volume",
    title: "USDC — 24h volume on Base",
    summary: `Across ${String(usdcPools.length)} USDC pools on Base, ${fmtUsd(total24h)} of volume cleared in the last 24h${
      Number.isFinite(trend) && avgDaily7d > 0
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
      { name: "DefiLlama (Base USDC pools)", url: "https://defillama.com/yields?chain=Base&token=USDC" },
    ],
  };
}

/**
 * Major USD-pegged stablecoins, ordered by canonical market-cap rank
 * (USDT > USDC > DAI > USDe > USDS > FDUSD > PYUSD). Ranking lives
 * here because we don't currently wire DefiLlama's stablecoins
 * endpoint — the order is stable enough between API calls that
 * baking it in is safer than re-fetching MC for every request.
 */
const STABLECOIN_LIST: { symbol: string; name: string; coingeckoId: string; issuer: string }[] = [
  { symbol: "USDT", name: "Tether", coingeckoId: "tether", issuer: "Tether" },
  { symbol: "USDC", name: "USD Coin", coingeckoId: "usd-coin", issuer: "Circle" },
  { symbol: "DAI", name: "Dai", coingeckoId: "dai", issuer: "Sky / Maker" },
  { symbol: "USDe", name: "Ethena USDe", coingeckoId: "ethena-usde", issuer: "Ethena" },
  { symbol: "USDS", name: "Sky USDS", coingeckoId: "usds", issuer: "Sky" },
  { symbol: "FDUSD", name: "First Digital USD", coingeckoId: "first-digital-usd", issuer: "First Digital" },
  { symbol: "PYUSD", name: "PayPal USD", coingeckoId: "paypal-usd", issuer: "PayPal / Paxos" },
];

async function topStablecoins(): Promise<AnalyzeResponse> {
  const keys = STABLECOIN_LIST.map((t) => `coingecko:${t.coingeckoId}`);
  const prices = await getTokenPrices(keys);
  const rows = STABLECOIN_LIST.map((t) => {
    const p = prices[`coingecko:${t.coingeckoId}`]?.price;
    return {
      ...t,
      price: p ?? 0,
      dev: p !== undefined ? (p - 1) * 100 : Number.POSITIVE_INFINITY,
    };
  }).filter((r) => r.price > 0);
  if (rows.length === 0) {
    return {
      topic: "top-stablecoins",
      title: "Top stablecoins",
      summary: "Couldn't pull live stablecoin prices right now. Try again in a minute.",
      sources: [{ name: "DefiLlama" }],
    };
  }
  // Sort by peg tightness (closest to $1 first). "Top performing" for
  // a stablecoin = holding its peg.
  const ranked = [...rows].sort((a, b) => Math.abs(a.dev) - Math.abs(b.dev));
  const winner = ranked[0]!;
  return {
    topic: "top-stablecoins",
    title: "Top stablecoins — peg health (24h)",
    summary: `Across the major USD-pegged names, ${winner.name} (${winner.symbol}) is holding tightest at ${fmtUsd(winner.price)} (${fmtPct(winner.dev)} from $1.00). Ordered by distance from peg:`,
    metrics: ranked.map((r) => ({
      label: `${r.symbol} (${r.issuer})`,
      value: `${fmtUsd(r.price)} · ${fmtPct(r.dev)} from peg`,
    })),
    sources: [
      { name: "DefiLlama (coins)", url: "https://defillama.com/coins" },
      { name: "DefiLlama stablecoins", url: "https://defillama.com/stablecoins" },
    ],
  };
}

async function tokenPrice(symbol: string): Promise<AnalyzeResponse> {
  const alias = resolveTokenAlias(symbol);
  if (!alias) {
    return {
      topic: "token-price",
      title: `Price lookup: ${symbol}`,
      summary: `I don't have ${symbol} in my alias map yet. Known names: bitcoin, ethereum, cbBTC, USDC, USDT, EURC, WETH, MKR, PENDLE, ONDO, CFG, SOL.`,
    };
  }
  const key = `coingecko:${alias.coingeckoId}`;
  const [prices, changes] = await Promise.all([
    getTokenPrices([key]),
    getTokenChangePercents([key]),
  ]);
  const price = prices[key]?.price;
  if (price === undefined) {
    return {
      topic: "token-price",
      title: `${alias.label} (${alias.symbol})`,
      summary: `DefiLlama didn't return a price for ${alias.label} just now. Try again in a moment.`,
    };
  }
  const change = changes[key] ?? 0;
  return {
    topic: "token-price",
    title: `${alias.label} (${alias.symbol}) spot price`,
    summary: `${alias.label} (${alias.symbol}) is trading at ${fmtUsd(price)}${
      Number.isFinite(change) ? `, ${fmtPct(change)} in the last 24h` : ""
    }.`,
    metrics: [
      { label: "Price", value: fmtUsd(price) },
      { label: "24h change", value: fmtPct(change) },
    ],
    sources: [
      { name: "DefiLlama", url: `https://defillama.com/coins/coingecko:${alias.coingeckoId}` },
    ],
  };
}

function mantuaHooks(): AnalyzeResponse {
  return {
    topic: "mantua-hooks",
    title: "Mantua hooks",
    summary:
      "Mantua ships two Liquidity Hooks on Uniswap v4: Dynamic Fee (any pair) and Stable Protection (USDC/EURC). Both plug into the pool lifecycle to add behavior vanilla pools can't.",
    bullets: [
      "Dynamic Fee — adjusts the per-swap fee on every trade based on a TWAP-derived volatility signal. Rewards LPs more during turbulence; cheaper for stable flow. Available on Base Sepolia and Unichain Sepolia, any pair.",
      "Stable Protection — peg-zone-aware pool. Reads virtual reserves at every swap, classifies HEALTHY / WARN / STRESS / CRITICAL, and blocks or surcharges trades to keep the pool from draining during depegs. Base Sepolia, USDC/EURC only.",
    ],
    sources: [
      { name: "Uniswap v4 Hooks", url: "https://docs.uniswap.org/contracts/v4/concepts/hooks" },
    ],
  };
}

const TOPIC_RUNNERS: Record<
  Exclude<Topic, "token-price">,
  () => Promise<AnalyzeResponse> | AnalyzeResponse
> = {
  "eth-price": ethPrice,
  "eurc-peg": eurcPeg,
  "usdc-eurc-pool": usdcEurcPool,
  "top-stablecoins": topStablecoins,
  "usdc-24h-volume": usdc24hVolume,
  "mantua-hooks": mantuaHooks,
};

/**
 * Per-topic response cache. CoinGecko's free tier (10–30 req/min)
 * gets blown out fast otherwise — every suggestion click previously
 * fired a fresh fetch even when the price barely changed. Two TTLs:
 * `freshTtl` is the "no need to refetch" window; `staleTtl` keeps a
 * stale response around so 429s during a brief upstream hiccup still
 * surface a real answer (with a tiny "cached" hint) instead of an
 * error card.
 */
interface CacheEntry {
  response: AnalyzeResponse;
  fetchedAt: number;
}
const cache = new Map<string, CacheEntry>();

const PRICE_TTL = { freshMs: 5 * 60_000, staleMs: 30 * 60_000 };
const POOL_TTL = { freshMs: 5 * 60_000, staleMs: 60 * 60_000 };
const STATIC_TTL = { freshMs: Number.MAX_SAFE_INTEGER, staleMs: Number.MAX_SAFE_INTEGER };

const TOPIC_TTL: Record<Topic, { freshMs: number; staleMs: number }> = {
  "mantua-hooks": STATIC_TTL,
  "eth-price": PRICE_TTL,
  "eurc-peg": PRICE_TTL,
  "top-stablecoins": PRICE_TTL,
  "token-price": PRICE_TTL,
  "usdc-eurc-pool": POOL_TTL,
  "usdc-24h-volume": POOL_TTL,
};

/**
 * Cache key for `token-price` includes the symbol so different
 * lookups don't clobber each other; everything else just keys on
 * the topic name.
 */
function cacheKey(topic: Topic, symbol?: string): string {
  return topic === "token-price" ? `token-price:${(symbol ?? "").toLowerCase()}` : topic;
}

export async function runAnalyze(topic: Topic, symbol?: string): Promise<AnalyzeResponse> {
  const ttl = TOPIC_TTL[topic];
  const key = cacheKey(topic, symbol);
  const cached = cache.get(key);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < ttl.freshMs) {
    return cached.response;
  }
  try {
    const response =
      topic === "token-price"
        ? await tokenPrice(symbol ?? "")
        : await TOPIC_RUNNERS[topic]();
    cache.set(key, { response, fetchedAt: now });
    return response;
  } catch (err) {
    logger.warn({ err, topic, symbol }, "analyze topic fetch failed");
    // Stale-while-error: if we have a cached answer that's still
    // within the stale window, serve it rather than 502'ing the user.
    if (cached && now - cached.fetchedAt < ttl.staleMs) {
      return {
        ...cached.response,
        summary: `${cached.response.summary} (cached)`,
      };
    }
    throw err;
  }
}

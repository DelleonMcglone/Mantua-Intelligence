import { formatUnits } from "viem";
import { getToken, isTokenSymbol, type TokenSymbol } from "./tokens.ts";
import { getUsdPrice } from "./usd-pricing.ts";
import { getTokenPrices } from "./defillama.ts";
import { quoteAgentSwap } from "./agent-swap.ts";

/**
 * Real-signal layer for the agent's decision logic.
 *
 * Every action the agent takes is grounded in observable data fetched here —
 * not assumptions. `getTradeSignals` returns a structured snapshot (peg
 * deviations, spot prices, the live quote-implied rate / price impact) plus a
 * `verdict` computed against explicit thresholds. The agent surfaces this
 * snapshot via the `get_signals` tool, and the swap path enforces the verdict
 * in code so the guardrail holds regardless of model behaviour.
 *
 * Posture: MODERATE (chosen). A swap that would ACQUIRE a stablecoin more than
 * `maxPegDeviationPct` off its peg, or whose price impact vs spot exceeds
 * `maxPriceImpactPct`, is held. Price impact also captures thin-liquidity /
 * stale-pool risk (a shallow pool fills far from spot).
 */

export const SIGNAL_THRESHOLDS = {
  /** Max |deviation| from peg for a stablecoin the swap would acquire (%). */
  maxPegDeviationPct: 0.5,
  /** Max adverse price impact of the swap vs spot (%). */
  maxPriceImpactPct: 1.0,
} as const;

/** Symbols we treat as pegged stablecoins for the peg guard. */
const PEGGED: readonly TokenSymbol[] = ["USDC", "EURC"] as const;

function isPegged(s: TokenSymbol): boolean {
  return (PEGGED as readonly string[]).includes(s);
}

export interface PegInfo {
  symbol: TokenSymbol;
  priceUsd: number;
  /** Peg target in USD (1.0 for USDC; the EUR reference for EURC). */
  targetUsd: number;
  deviationPct: number;
}

export interface TradeSignal {
  tokenIn: TokenSymbol;
  tokenOut: TokenSymbol;
  amountIn: string;
  amountOut: number;
  /** tokenOut received per tokenIn, from the live pool quote. */
  quotedRate: number;
  /** tokenOut per tokenIn implied by spot USD prices. */
  spotRate: number;
  /** Positive = filled worse than spot by this %. NaN if prices unavailable. */
  priceImpactPct: number;
}

export interface TradeSignals {
  thresholds: typeof SIGNAL_THRESHOLDS;
  prices: Record<string, number>;
  pegs: PegInfo[];
  trade?: TradeSignal | undefined;
  verdict: { ok: boolean; reasons: string[] };
}

/** Peg deviation for a single stablecoin, or null when pricing is unavailable. */
async function pegFor(symbol: TokenSymbol): Promise<PegInfo | null> {
  if (symbol === "USDC") {
    const p = await getUsdPrice("USDC");
    if (!p) return null;
    return { symbol, priceUsd: p, targetUsd: 1, deviationPct: (p - 1) * 100 };
  }
  if (symbol === "EURC") {
    // EURC pegs to EUR, not USD. Cross EURC's USD price against agEUR (another
    // EUR stablecoin) to get an FX-free implied EURC/EUR peg ratio.
    const m = await getTokenPrices(["coingecko:euro-coin", "coingecko:ageur"]);
    const eurc = m["coingecko:euro-coin"]?.price;
    const ref = m["coingecko:ageur"]?.price;
    if (!eurc || !ref) return null;
    return { symbol, priceUsd: eurc, targetUsd: ref, deviationPct: (eurc / ref - 1) * 100 };
  }
  return null;
}

/**
 * Compute the signal snapshot + verdict. Resilient: when a price feed is
 * unavailable a check is simply omitted (verdict stays ok unless a threshold
 * is definitively breached) — we never block a swap on a flaky feed.
 */
export async function getTradeSignals(args: {
  tokenIn?: TokenSymbol;
  tokenOut?: TokenSymbol;
  amountIn?: string;
}): Promise<TradeSignals> {
  const involved = [args.tokenIn, args.tokenOut].filter(
    (s): s is TokenSymbol => typeof s === "string",
  );
  const symbols =
    involved.length > 0 ? [...new Set(involved)] : (["USDC", "EURC"] as TokenSymbol[]);

  const prices: Record<string, number> = {};
  await Promise.all(
    symbols.map(async (s) => {
      prices[s] = await getUsdPrice(s);
    }),
  );

  const pegTargets = symbols.filter(isPegged);
  const pegList = pegTargets.length > 0 ? pegTargets : (["USDC", "EURC"] as TokenSymbol[]);
  const pegs = (await Promise.all(pegList.map(pegFor))).filter((p): p is PegInfo => p !== null);

  const reasons: string[] = [];
  let trade: TradeSignal | undefined;

  if (args.tokenIn && args.tokenOut && args.amountIn && args.tokenIn !== args.tokenOut) {
    const q = await quoteAgentSwap({
      tokenIn: args.tokenIn,
      tokenOut: args.tokenOut,
      amountIn: args.amountIn,
    });
    const amountOut = Number(formatUnits(BigInt(q.amountOutRaw), getToken(args.tokenOut).decimals));
    const amountInNum = Number(args.amountIn);
    const quotedRate = amountInNum > 0 ? amountOut / amountInNum : NaN;
    const priceIn = prices[args.tokenIn] ?? 0;
    const priceOut = prices[args.tokenOut] ?? 0;
    const spotRate = priceIn > 0 && priceOut > 0 ? priceIn / priceOut : NaN;
    const priceImpactPct =
      Number.isFinite(spotRate) && spotRate > 0 && Number.isFinite(quotedRate)
        ? ((spotRate - quotedRate) / spotRate) * 100
        : NaN;
    trade = {
      tokenIn: args.tokenIn,
      tokenOut: args.tokenOut,
      amountIn: args.amountIn,
      amountOut,
      quotedRate,
      spotRate,
      priceImpactPct,
    };
    if (Number.isFinite(priceImpactPct) && priceImpactPct > SIGNAL_THRESHOLDS.maxPriceImpactPct) {
      reasons.push(
        `price impact ${priceImpactPct.toFixed(2)}% exceeds the ${String(SIGNAL_THRESHOLDS.maxPriceImpactPct)}% limit (thin liquidity or a stale pool)`,
      );
    }
  }

  // Peg guard applies to the token the swap would ACQUIRE (tokenOut). Selling a
  // depegged asset is fine (fleeing a depeg); acquiring one is the risk.
  if (args.tokenOut && isPegged(args.tokenOut)) {
    const peg = pegs.find((p) => p.symbol === args.tokenOut);
    if (peg && Math.abs(peg.deviationPct) > SIGNAL_THRESHOLDS.maxPegDeviationPct) {
      reasons.push(
        `${args.tokenOut} is ${peg.deviationPct.toFixed(2)}% off its peg (limit ±${String(SIGNAL_THRESHOLDS.maxPegDeviationPct)}%)`,
      );
    }
  }

  return {
    thresholds: SIGNAL_THRESHOLDS,
    prices,
    pegs,
    trade,
    verdict: { ok: reasons.length === 0, reasons },
  };
}

/** Validated arguments for `getTradeSignals`, as parsed from a request query. */
export interface SignalsQuery {
  tokenIn?: TokenSymbol;
  tokenOut?: TokenSymbol;
  amountIn?: string;
}

export type ParseSignalsResult =
  | { ok: true; value: SignalsQuery }
  | { ok: false; error: string };

/**
 * Pure validator for the `GET /api/signals` query string. Mirrors what
 * `getTradeSignals` actually consumes: all params are optional (no params →
 * peg-only snapshot), but anything supplied must be well-formed so the route
 * fails fast instead of silently dropping a typo'd symbol or a junk amount.
 *
 * Kept network-free and side-effect-free so it can be unit tested directly.
 */
export function parseSignalsQuery(query: Record<string, unknown>): ParseSignalsResult {
  const asString = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

  const out: SignalsQuery = {};

  for (const key of ["tokenIn", "tokenOut"] as const) {
    const raw = asString(query[key]);
    if (raw === undefined) continue;
    if (!isTokenSymbol(raw)) {
      return { ok: false, error: `Unknown token symbol for ${key}: ${raw}` };
    }
    out[key] = raw;
  }

  const amountRaw = asString(query.amountIn);
  if (amountRaw !== undefined) {
    const n = Number(amountRaw);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: `amountIn must be a positive number: ${amountRaw}` };
    }
    out.amountIn = amountRaw;
  }

  if (out.tokenIn && out.tokenOut && out.tokenIn === out.tokenOut) {
    return { ok: false, error: "tokenIn and tokenOut must differ" };
  }

  return { ok: true, value: out };
}

/**
 * Live on-chain odds for the board: read each market pool's current price
 * via StateView and express it back as implied probability. Once a pool
 * trades, ITS price is the market's opinion — the provider's number is
 * only the opening seed. Fail-open per event: any chain hiccup leaves the
 * event with provider odds rather than blanking the board.
 */

import { computeMarketId } from "../market-id.ts";
import { sqrtPriceX96ToProbability } from "../probability.ts";
import { baseRpcClient } from "../rpc-client.ts";
import {
  MARKETS_ARC,
  MARKETS_PERIPHERY_ARC,
  MARKET_ABI,
  MARKET_FACTORY_ABI,
  STATE_VIEW_ABI,
} from "../markets-contracts.ts";
import { DYNAMIC_MARKET_ARC } from "../v4-contracts.ts";
import { planMarketPool } from "./market-pool.ts";
import type { PublicSlate } from "./public-slate.ts";

const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { at: number; value: PublicSlate }>();

async function liveHomeProbabilityBps(providerEventId: string): Promise<number | null> {
  const marketId = computeMarketId({ providerEventId, marketType: "moneyline", outcomeIndex: 0 });
  const market = await baseRpcClient.readContract({
    address: MARKETS_ARC.factory,
    abi: MARKET_FACTORY_ABI,
    functionName: "marketOf",
    args: [marketId],
  });
  if (market === "0x0000000000000000000000000000000000000000") return null;

  const yesToken = await baseRpcClient.readContract({
    address: market,
    abi: MARKET_ABI,
    functionName: "yesToken",
  });
  const plan = planMarketPool(yesToken, MARKETS_ARC.collateral, DYNAMIC_MARKET_ARC.hook, 0.5);
  const [sqrtPriceX96] = await baseRpcClient.readContract({
    address: MARKETS_PERIPHERY_ARC.stateView,
    abi: STATE_VIEW_ABI,
    functionName: "getSlot0",
    args: [plan.poolId],
  });
  if (sqrtPriceX96 === 0n) return null; // pool not initialized
  const p = sqrtPriceX96ToProbability(sqrtPriceX96, plan.yesIsToken0);
  return Math.round(p * 10_000);
}

/**
 * Overlay live pool odds onto a public slate. The home market's pool price
 * replaces `homeWinProbabilityBps` (the away card cell is its complement,
 * exactly like the provider number) and `liveOdds` marks the event so the
 * UI can label market prices as the market's own.
 */
export async function withLiveOdds(slate: PublicSlate): Promise<PublicSlate> {
  const cached = cache.get(slate.league);
  if (
    cached &&
    Date.now() - cached.at < CACHE_TTL_MS &&
    cached.value.fetchedAt === slate.fetchedAt
  ) {
    return cached.value;
  }

  const events = await Promise.all(
    slate.events.map(async (event) => {
      try {
        const live = await liveHomeProbabilityBps(event.providerEventId);
        if (live === null) return event;
        return { ...event, homeWinProbabilityBps: live, liveOdds: true };
      } catch {
        return event; // fail-open to provider odds
      }
    }),
  );

  const enriched: PublicSlate = { ...slate, events };
  cache.set(slate.league, { at: Date.now(), value: enriched });
  return enriched;
}

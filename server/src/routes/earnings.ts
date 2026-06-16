import { Router, type Request, type Response } from "express";
import { formatUnits } from "viem";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { pools, positions } from "../db/schema/trading.ts";
import { users } from "../db/schema/users.ts";
import { logger } from "../lib/logger.ts";
import { DEFAULT_CHAIN_ID } from "../lib/chains.ts";
import { getTokens, type Token } from "../lib/tokens.ts";
import { tokenAmountUsdForToken } from "../lib/usd-pricing.ts";
import { readAccruedFees } from "../lib/v4-accrued-fees.ts";
import { buildCollectFeesCalldata } from "../lib/v4-remove-liquidity.ts";
import { requireAuth } from "../middleware/auth.ts";

export const earningsRouter = Router();

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Look up a known token by address (case-insensitive). null if unknown. */
function tokenByAddress(address: string): Token | null {
  const lower = address.toLowerCase();
  const tokens = getTokens(DEFAULT_CHAIN_ID);
  for (const sym of Object.keys(tokens)) {
    if (tokens[sym].address.toLowerCase() === lower) return tokens[sym];
  }
  return null;
}

interface EarningPosition {
  tokenId: string;
  hookAddress: string | null;
  sym0: string;
  sym1: string;
  accrued0: string;
  accrued1: string;
  accrued0Human: number;
  accrued1Human: number;
  accruedUsd: number;
}

/**
 * Real uncollected swap fees across the user's open positions, read live from
 * v4 (feeGrowthInside math). No fabricated figures — positions with no accrued
 * fees report 0. Token amounts are exact; USD is best-effort from price feeds.
 */
earningsRouter.get("/api/earnings", requireAuth, async (req: Request, res: Response) => {
  if (!req.privyUserId) {
    res.status(401).json({ error: "Auth required", code: "UNAUTHENTICATED" });
    return;
  }
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.privyUserId, req.privyUserId))
      .limit(1);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- drizzle types the row as defined, but the array is empty for an unknown user.
    if (!user) {
      res.json({ totalAccruedUsd: 0, positions: [] });
      return;
    }

    const rows = await db
      .select({
        tokenId: positions.tokenId,
        tickLower: positions.tickLower,
        tickUpper: positions.tickUpper,
        token0: pools.token0,
        token1: pools.token1,
        fee: pools.fee,
        tickSpacing: pools.tickSpacing,
        hookAddress: pools.hookAddress,
      })
      .from(positions)
      .innerJoin(pools, eq(positions.poolId, pools.id))
      .where(and(eq(positions.userId, user.id), eq(positions.status, "open")));

    const out: EarningPosition[] = [];
    let totalAccruedUsd = 0;
    for (const r of rows) {
      if (!r.tokenId) continue;
      const t0 = tokenByAddress(r.token0);
      const t1 = tokenByAddress(r.token1);
      let accrued: { amount0: bigint; amount1: bigint } = { amount0: 0n, amount1: 0n };
      try {
        accrued = await readAccruedFees(
          {
            currency0: r.token0 as `0x${string}`,
            currency1: r.token1 as `0x${string}`,
            fee: r.fee,
            tickSpacing: r.tickSpacing,
            hooks: (r.hookAddress ?? ZERO_ADDRESS) as `0x${string}`,
          },
          BigInt(r.tokenId),
          r.tickLower,
          r.tickUpper,
        );
      } catch (err) {
        // Read failures (rwa-gate periphery edge, RPC blip) degrade to 0 for
        // that position rather than 500 the whole tab.
        logger.warn({ err, tokenId: r.tokenId }, "accrued-fee read failed");
      }

      const usd0 = t0 ? await tokenAmountUsdForToken(t0, accrued.amount0) : 0;
      const usd1 = t1 ? await tokenAmountUsdForToken(t1, accrued.amount1) : 0;
      const accruedUsd = usd0 + usd1;
      totalAccruedUsd += accruedUsd;

      out.push({
        tokenId: r.tokenId,
        hookAddress: r.hookAddress,
        sym0: t0?.symbol ?? r.token0,
        sym1: t1?.symbol ?? r.token1,
        accrued0: accrued.amount0.toString(),
        accrued1: accrued.amount1.toString(),
        accrued0Human: t0 ? Number(formatUnits(accrued.amount0, t0.decimals)) : 0,
        accrued1Human: t1 ? Number(formatUnits(accrued.amount1, t1.decimals)) : 0,
        accruedUsd,
      });
    }

    res.json({ totalAccruedUsd, positions: out });
  } catch (err) {
    logger.error({ err }, "GET /api/earnings failed");
    res.status(500).json({ error: "Failed to read earnings", code: "EARNINGS_FAILED" });
  }
});

interface SweepTx {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
  tokenId: string;
  pair: string;
}

/**
 * Build the calldata to sweep (collect) accrued swap fees from every open,
 * on-chain position the user owns. One `modifyLiquidities` collect tx per
 * position (each routed to its hook's PositionManager); the client signs +
 * sends them. Returns an empty list when there's nothing to collect.
 */
earningsRouter.post(
  "/api/earnings/sweep/calldata",
  requireAuth,
  async (req: Request, res: Response) => {
    if (!req.privyUserId) {
      res.status(401).json({ error: "Auth required", code: "UNAUTHENTICATED" });
      return;
    }
    const recipient = req.walletAddress as `0x${string}` | undefined;
    if (!recipient) {
      res.status(401).json({ error: "Wallet required", code: "WALLET_REQUIRED" });
      return;
    }
    try {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.privyUserId, req.privyUserId))
        .limit(1);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- drizzle types the row as defined, but the array is empty for an unknown user.
      if (!user) {
        res.json({ txs: [] });
        return;
      }

      const rows = await db
        .select({
          tokenId: positions.tokenId,
          token0: pools.token0,
          token1: pools.token1,
          hookAddress: pools.hookAddress,
        })
        .from(positions)
        .innerJoin(pools, eq(positions.poolId, pools.id))
        .where(and(eq(positions.userId, user.id), eq(positions.status, "open")));

      const deadlineSeconds = Math.floor(Date.now() / 1000) + 1200;
      const txs: SweepTx[] = [];
      for (const r of rows) {
        if (!r.tokenId) continue; // no on-chain id → nothing to collect
        const cd = buildCollectFeesCalldata({
          tokenId: BigInt(r.tokenId),
          currency0: r.token0 as `0x${string}`,
          currency1: r.token1 as `0x${string}`,
          hookAddress: r.hookAddress as `0x${string}` | null,
          recipient,
          deadlineSeconds,
        });
        txs.push({ ...cd, tokenId: r.tokenId, pair: `${r.token0}/${r.token1}` });
      }

      res.json({ txs });
    } catch (err) {
      logger.error({ err }, "POST /api/earnings/sweep/calldata failed");
      res.status(500).json({ error: "Failed to build sweep calldata", code: "SWEEP_FAILED" });
    }
  },
);

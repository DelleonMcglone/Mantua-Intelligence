import { Router, type Request, type Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { pools, portfolioTransactions, positions } from "../db/schema/trading.ts";
import { users } from "../db/schema/users.ts";
import { logger } from "../lib/logger.ts";
import { requireAuth } from "../middleware/auth.ts";

export const positionsRouter = Router();

/**
 * P4-009 — list the user's open positions. Sourced from the positions
 * table populated by /api/liquidity/add/record + /remove/record. Pre-
 * existing on-chain positions (created outside Mantua) require subgraph
 * indexing — tracked as a follow-up.
 *
 * Each row also includes the most recent known sqrtPriceX96 for the pool
 * (read from `portfolio_transactions.params->>'sqrtPriceX96'` on the
 * latest add_liquidity for that user+pool). Used by the remove flow to
 * compute slippage bounds; Phase 4e adds StateView.getSlot0 fetching for
 * a real-time replacement.
 */
positionsRouter.get("/api/positions", requireAuth, async (req: Request, res: Response) => {
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
    if (!user) {
      res.json({ positions: [] });
      return;
    }
    const rows = await db
      .select({
        id: positions.id,
        tokenId: positions.tokenId,
        tickLower: positions.tickLower,
        tickUpper: positions.tickUpper,
        liquidity: positions.liquidity,
        status: positions.status,
        openedTx: positions.openedTx,
        closedTx: positions.closedTx,
        createdAt: positions.createdAt,
        poolKeyHash: pools.poolKeyHash,
        token0: pools.token0,
        token1: pools.token1,
        fee: pools.fee,
        tickSpacing: pools.tickSpacing,
        hookAddress: pools.hookAddress,
        // Latest known sqrtPriceX96 from the most recent add_liquidity
        // tx params blob for this user+pool. Approximation only.
        latestSqrtPriceX96: sql<string | null>`(
          SELECT params->>'sqrtPriceX96'
          FROM ${portfolioTransactions}
          WHERE user_id = ${user.id}
            AND action = 'add_liquidity'
            AND outcome = 'success'
            AND params->>'poolKeyHash' = ${pools.poolKeyHash}
          ORDER BY created_at DESC
          LIMIT 1
        )`,
      })
      .from(positions)
      .innerJoin(pools, eq(positions.poolId, pools.id))
      .where(and(eq(positions.userId, user.id), eq(positions.status, "open")))
      .orderBy(desc(positions.createdAt));

    res.json({ positions: rows });
  } catch (err) {
    logger.error({ err }, "GET /api/positions failed");
    res.status(500).json({ error: "Failed to load positions", code: "INTERNAL" });
  }
});

import { Router, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { pools, positions } from "../db/schema/trading.ts";
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
 * The remove flow no longer needs a price reference in this response;
 * Phase 4e moved live slot0 reads server-side into the remove calldata
 * route via StateView.
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

import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { pools, portfolioTransactions, positions } from "../db/schema/trading.ts";
import { users } from "../db/schema/users.ts";
import { logAudit } from "../lib/audit.ts";
import { BASE_CHAIN_ID } from "../lib/constants.ts";
import { logger } from "../lib/logger.ts";
import { ZERO_ADDRESS } from "../lib/tokens.ts";
import { getRequestContext } from "../lib/request-context.ts";
import { buildRemoveLiquidityCalldata } from "../lib/v4-remove-liquidity.ts";
import { readSlot0 } from "../lib/v4-state-view.ts";
import { requireAuth } from "../middleware/auth.ts";
import { writeRateLimiter } from "../middleware/rate-limit.ts";
import { calldataSchema, recordSchema } from "./liquidity-remove-schemas.ts";

export const liquidityRemoveRouter = Router();

liquidityRemoveRouter.post(
  "/api/liquidity/remove/calldata",
  writeRateLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = calldataSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", code: "BAD_REQUEST" });
      return;
    }
    const ctx = getRequestContext(req);
    if (!ctx.walletAddress || !req.privyUserId) {
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
        res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
        return;
      }
      const [pos] = await db
        .select({
          tokenId: positions.tokenId,
          tickLower: positions.tickLower,
          tickUpper: positions.tickUpper,
          liquidity: positions.liquidity,
          status: positions.status,
          token0: pools.token0,
          token1: pools.token1,
          fee: pools.fee,
          tickSpacing: pools.tickSpacing,
          hookAddress: pools.hookAddress,
        })
        .from(positions)
        .innerJoin(pools, eq(positions.poolId, pools.id))
        .where(and(eq(positions.id, parsed.data.positionId), eq(positions.userId, user.id)))
        .limit(1);
      if (!pos || pos.status !== "open") {
        res.status(404).json({ error: "Position not found or closed", code: "POSITION_NOT_FOUND" });
        return;
      }
      if (!pos.tokenId) {
        res.status(400).json({
          error: "Position has no on-chain tokenId",
          code: "POSITION_NO_TOKEN_ID",
        });
        return;
      }

      const slot0 = await readSlot0({
        currency0: pos.token0 as `0x${string}`,
        currency1: pos.token1 as `0x${string}`,
        fee: pos.fee,
        tickSpacing: pos.tickSpacing,
        hooks: (pos.hookAddress ?? ZERO_ADDRESS) as `0x${string}`,
      });
      if (!slot0) {
        res.status(400).json({
          error: "Pool not initialized on-chain",
          code: "POOL_NOT_INITIALIZED",
        });
        return;
      }

      const totalLiquidity = BigInt(pos.liquidity);
      const liquidityToRemove = (totalLiquidity * BigInt(parsed.data.percentage)) / 100n;

      const result = buildRemoveLiquidityCalldata({
        tokenId: BigInt(pos.tokenId),
        liquidityToRemove,
        positionLiquidity: totalLiquidity,
        tickLower: pos.tickLower,
        tickUpper: pos.tickUpper,
        sqrtPriceX96: slot0.sqrtPriceX96,
        currency0: pos.token0 as `0x${string}`,
        currency1: pos.token1 as `0x${string}`,
        slippageBps: parsed.data.slippageBps,
        recipient: ctx.walletAddress as `0x${string}`,
        deadlineSeconds: parsed.data.deadlineSeconds,
      });

      res.json({
        ...result,
        liquidityToRemove: liquidityToRemove.toString(),
        positionLiquidity: totalLiquidity.toString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "calldata failed";
      logger.warn({ err }, "POST /api/liquidity/remove/calldata failed");
      res.status(400).json({ error: message, code: "REMOVE_LIQUIDITY_INVALID" });
    }
  },
);

liquidityRemoveRouter.post(
  "/api/liquidity/remove/record",
  writeRateLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = recordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", code: "BAD_REQUEST" });
      return;
    }
    const ctx = getRequestContext(req);
    if (!ctx.walletAddress || !req.privyUserId) {
      res.status(401).json({ error: "Auth required", code: "UNAUTHENTICATED" });
      return;
    }
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.privyUserId, req.privyUserId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }
    const v = parsed.data;

    await db.insert(portfolioTransactions).values({
      userId: user.id,
      walletAddress: ctx.walletAddress,
      action: "remove_liquidity",
      txHash: v.txHash,
      chainId: BASE_CHAIN_ID,
      params: {
        positionId: v.positionId,
        liquidityRemoved: v.liquidityRemoved,
        isFullExit: v.isFullExit,
      },
      outcome: v.outcome,
    });

    if (v.outcome === "success" && v.isFullExit) {
      await db
        .update(positions)
        .set({ status: "closed", closedTx: v.txHash })
        .where(and(eq(positions.id, v.positionId), eq(positions.userId, user.id)));
    } else if (v.outcome === "success") {
      const [pos] = await db
        .select({ liquidity: positions.liquidity })
        .from(positions)
        .where(eq(positions.id, v.positionId))
        .limit(1);
      if (pos) {
        const remaining = BigInt(pos.liquidity) - BigInt(v.liquidityRemoved);
        await db
          .update(positions)
          .set({ liquidity: remaining.toString() })
          .where(eq(positions.id, v.positionId));
      }
    }
    await logAudit({
      ...ctx,
      action: "remove_liquidity",
      outcome: v.outcome,
      txHash: v.txHash,
      params: { positionId: v.positionId, liquidityRemoved: v.liquidityRemoved },
    });
    res.json({ ok: true });
  },
);

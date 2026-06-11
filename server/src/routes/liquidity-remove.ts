import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { pools, portfolioTransactions, positions } from "../db/schema/trading.ts";
import { users } from "../db/schema/users.ts";
import { logAudit } from "../lib/audit.ts";
import { ACTIVE_CHAIN_ID } from "../lib/constants.ts";
import { logger } from "../lib/logger.ts";
import { ZERO_ADDRESS } from "../lib/tokens.ts";
import { getRequestContext } from "../lib/request-context.ts";
import { baseRpcClient } from "../lib/rpc-client.ts";
import { buildRemoveLiquidityCalldata } from "../lib/v4-remove-liquidity.ts";
import { decodePositionInfo } from "../lib/v4-position-info.ts";
import { POSITION_MANAGER_VIEW_ABI, V4_POSITION_MANAGER } from "../lib/v4-contracts.ts";
import { readSlot0 } from "../lib/v4-state-view.ts";
import { requireAuth } from "../middleware/auth.ts";
import { writeRateLimiter } from "../middleware/rate-limit.ts";
import { calldataSchema, recordSchema } from "./liquidity-remove-schemas.ts";

interface ResolvedPosition {
  tokenId: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hookAddress: `0x${string}` | null;
}

/**
 * Resolve the on-chain position state for a tokenId, verifying that
 * the connected wallet owns the NFT. Used for positions that exist
 * on-chain + in localStorage but never landed in our `positions` DB
 * row (e.g. testnet pools created before the pool/positions tables
 * had their writes wired up).
 */
async function resolveByTokenId(
  tokenId: string,
  walletAddress: string,
): Promise<ResolvedPosition | { error: string; code: string; status: number }> {
  const tokenIdBig = BigInt(tokenId);
  let owner: `0x${string}`;
  try {
    owner = await baseRpcClient.readContract({
      address: V4_POSITION_MANAGER,
      abi: POSITION_MANAGER_VIEW_ABI,
      functionName: "ownerOf",
      args: [tokenIdBig],
    });
  } catch {
    return {
      error: "Position not found on-chain.",
      code: "POSITION_NOT_FOUND",
      status: 404,
    };
  }
  if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
    return {
      error: "You do not own this position.",
      code: "POSITION_NOT_OWNED",
      status: 403,
    };
  }
  const [poolAndInfo, liquidity] = await Promise.all([
    baseRpcClient.readContract({
      address: V4_POSITION_MANAGER,
      abi: POSITION_MANAGER_VIEW_ABI,
      functionName: "getPoolAndPositionInfo",
      args: [tokenIdBig],
    }),
    baseRpcClient.readContract({
      address: V4_POSITION_MANAGER,
      abi: POSITION_MANAGER_VIEW_ABI,
      functionName: "getPositionLiquidity",
      args: [tokenIdBig],
    }),
  ]);
  const [poolKey, info] = poolAndInfo;
  const decoded = decodePositionInfo(info);
  return {
    tokenId,
    tickLower: decoded.tickLower,
    tickUpper: decoded.tickUpper,
    liquidity: liquidity.toString(),
    token0: poolKey.currency0,
    token1: poolKey.currency1,
    fee: poolKey.fee,
    tickSpacing: poolKey.tickSpacing,
    hookAddress: poolKey.hooks === ZERO_ADDRESS ? null : poolKey.hooks,
  };
}

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
      let pos: ResolvedPosition;
      if (parsed.data.tokenId) {
        const result = await resolveByTokenId(parsed.data.tokenId, ctx.walletAddress);
        if ("error" in result) {
          res.status(result.status).json({ error: result.error, code: result.code });
          return;
        }
        pos = result;
      } else {
        const positionId = parsed.data.positionId;
        if (!positionId) {
          res.status(400).json({ error: "Missing position identifier", code: "BAD_REQUEST" });
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
        const [row] = await db
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
          .where(and(eq(positions.id, positionId), eq(positions.userId, user.id)))
          .limit(1);
        if (!row || row.status !== "open") {
          res
            .status(404)
            .json({ error: "Position not found or closed", code: "POSITION_NOT_FOUND" });
          return;
        }
        if (!row.tokenId) {
          res
            .status(400)
            .json({ error: "Position has no on-chain tokenId", code: "POSITION_NO_TOKEN_ID" });
          return;
        }
        pos = {
          tokenId: row.tokenId,
          tickLower: row.tickLower,
          tickUpper: row.tickUpper,
          liquidity: row.liquidity,
          token0: row.token0 as `0x${string}`,
          token1: row.token1 as `0x${string}`,
          fee: row.fee,
          tickSpacing: row.tickSpacing,
          hookAddress: row.hookAddress as `0x${string}` | null,
        };
      }

      const slot0 = await readSlot0({
        currency0: pos.token0,
        currency1: pos.token1,
        fee: pos.fee,
        tickSpacing: pos.tickSpacing,
        hooks: pos.hookAddress ?? ZERO_ADDRESS,
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
        currency0: pos.token0,
        currency1: pos.token1,
        hookAddress: pos.hookAddress,
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
      chainId: ACTIVE_CHAIN_ID,
      params: {
        ...(v.positionId ? { positionId: v.positionId } : {}),
        ...(v.tokenId ? { tokenId: v.tokenId } : {}),
        liquidityRemoved: v.liquidityRemoved,
        isFullExit: v.isFullExit,
      },
      outcome: v.outcome,
    });

    // Only touch the positions table when we have a DB row to update —
    // tokenId-only flows (testnet positions without a server-side row)
    // skip this and rely on the portfolio_transactions audit alone.
    if (v.outcome === "success" && v.positionId) {
      if (v.isFullExit) {
        await db
          .update(positions)
          .set({ status: "closed", closedTx: v.txHash })
          .where(and(eq(positions.id, v.positionId), eq(positions.userId, user.id)));
      } else {
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
    }
    await logAudit({
      ...ctx,
      action: "remove_liquidity",
      outcome: v.outcome,
      txHash: v.txHash,
      params: {
        ...(v.positionId ? { positionId: v.positionId } : {}),
        ...(v.tokenId ? { tokenId: v.tokenId } : {}),
        liquidityRemoved: v.liquidityRemoved,
      },
    });
    res.json({ ok: true });
  },
);

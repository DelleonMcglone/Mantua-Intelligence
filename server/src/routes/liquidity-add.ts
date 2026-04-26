import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { pools, portfolioTransactions, positions } from "../db/schema/trading.ts";
import { users } from "../db/schema/users.ts";
import { logAudit } from "../lib/audit.ts";
import { BASE_CHAIN_ID } from "../lib/constants.ts";
import { logger } from "../lib/logger.ts";
import { getRequestContext } from "../lib/request-context.ts";
import { tokenAmountUsd } from "../lib/usd-pricing.ts";
import { buildAddLiquidityCalldata } from "../lib/v4-add-liquidity.ts";
import { requireAuth } from "../middleware/auth.ts";
import { writeRateLimiter } from "../middleware/rate-limit.ts";
import { calldataSchema, recordSchema } from "./liquidity-add-schemas.ts";

export const liquidityAddRouter = Router();

liquidityAddRouter.post(
  "/api/liquidity/add/calldata",
  writeRateLimiter,
  requireAuth,
  (req: Request, res: Response) => {
    const parsed = calldataSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request",
        code: "BAD_REQUEST",
        details: parsed.error.issues,
      });
      return;
    }
    const ctx = getRequestContext(req);
    if (!ctx.walletAddress) {
      res.status(401).json({ error: "Wallet not linked", code: "WALLET_REQUIRED" });
      return;
    }
    if (parsed.data.tokenA === parsed.data.tokenB) {
      res.status(400).json({ error: "tokenA and tokenB must differ", code: "BAD_REQUEST" });
      return;
    }
    try {
      const result = buildAddLiquidityCalldata({
        tokenA: parsed.data.tokenA,
        tokenB: parsed.data.tokenB,
        fee: parsed.data.fee,
        amountARaw: BigInt(parsed.data.amountARaw),
        amountBRaw: BigInt(parsed.data.amountBRaw),
        sqrtPriceX96: BigInt(parsed.data.sqrtPriceX96),
        slippageBps: parsed.data.slippageBps,
        owner: ctx.walletAddress as `0x${string}`,
        deadlineSeconds: parsed.data.deadlineSeconds,
      });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "calldata failed";
      logger.warn({ err }, "POST /api/liquidity/add/calldata failed");
      res.status(400).json({ error: message, code: "ADD_LIQUIDITY_INVALID" });
    }
  },
);

liquidityAddRouter.post(
  "/api/liquidity/add/record",
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
    const v = parsed.data;
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.privyUserId, req.privyUserId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    const usdValue = await tokenAmountUsd(v.tokenA, BigInt(v.amountARaw));
    const params = {
      tokenA: v.tokenA,
      tokenB: v.tokenB,
      fee: v.fee,
      amountARaw: v.amountARaw,
      amountBRaw: v.amountBRaw,
      liquidity: v.liquidity,
      tickLower: v.tickLower,
      tickUpper: v.tickUpper,
      poolKeyHash: v.poolKeyHash,
    };

    await db.insert(portfolioTransactions).values({
      userId: user.id,
      walletAddress: ctx.walletAddress,
      action: "add_liquidity",
      txHash: v.txHash,
      chainId: BASE_CHAIN_ID,
      params,
      outcome: v.outcome,
      usdValue: usdValue > 0 ? String(usdValue.toFixed(2)) : null,
    });

    if (v.outcome === "success") {
      const [pool] = await db
        .select({ id: pools.id })
        .from(pools)
        .where(eq(pools.poolKeyHash, v.poolKeyHash))
        .limit(1);
      if (pool) {
        await db.insert(positions).values({
          userId: user.id,
          poolId: pool.id,
          ...(v.tokenId ? { tokenId: v.tokenId } : {}),
          tickLower: v.tickLower,
          tickUpper: v.tickUpper,
          liquidity: v.liquidity,
          status: "open",
          openedTx: v.txHash,
        });
      }
    }
    await logAudit({ ...ctx, action: "add_liquidity", outcome: v.outcome, txHash: v.txHash, params });
    res.json({ ok: true });
  },
);

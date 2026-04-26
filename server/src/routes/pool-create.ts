import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { encodeFunctionData } from "viem";
import { db } from "../db/client.ts";
import { pools as poolsTable } from "../db/schema/trading.ts";
import { logAudit } from "../lib/audit.ts";
import { logger } from "../lib/logger.ts";
import { buildPoolKey } from "../lib/pool-key.ts";
import { getRequestContext } from "../lib/request-context.ts";
import { encodeSqrtPriceX96 } from "../lib/sqrt-price.ts";
import { getToken, isTokenSymbol } from "../lib/tokens.ts";
import {
  POOL_MANAGER_INITIALIZE_ABI,
  V4_POOL_MANAGER,
  isFeeTier,
} from "../lib/v4-contracts.ts";
import { requireAuth } from "../middleware/auth.ts";
import { writeRateLimiter } from "../middleware/rate-limit.ts";
import { keccak256, toHex } from "viem";

export const poolCreateRouter = Router();

const calldataSchema = z.object({
  tokenA: z.string().refine(isTokenSymbol, "Unknown tokenA"),
  tokenB: z.string().refine(isTokenSymbol, "Unknown tokenB"),
  fee: z.number().int().refine(isFeeTier, "Fee tier must be 100/500/3000/10000"),
  /** Initial price expressed as raw amounts of each side (base units). */
  initialAmount0Raw: z.string().regex(/^\d+$/),
  initialAmount1Raw: z.string().regex(/^\d+$/),
});

poolCreateRouter.post(
  "/api/pools/create/calldata",
  writeRateLimiter,
  requireAuth,
  (req: Request, res: Response) => {
    const parsed = calldataSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", code: "BAD_REQUEST", details: parsed.error.issues });
      return;
    }
    const { tokenA, tokenB, fee, initialAmount0Raw, initialAmount1Raw } = parsed.data;
    if (tokenA === tokenB) {
      res.status(400).json({ error: "tokenA and tokenB must differ", code: "BAD_REQUEST" });
      return;
    }
    try {
      const { key, flipped } = buildPoolKey(tokenA, tokenB, fee);
      const a0 = BigInt(initialAmount0Raw);
      const a1 = BigInt(initialAmount1Raw);
      const sqrtPriceX96 = encodeSqrtPriceX96(
        flipped ? { amount0Raw: a1, amount1Raw: a0 } : { amount0Raw: a0, amount1Raw: a1 },
      );
      const data = encodeFunctionData({
        abi: POOL_MANAGER_INITIALIZE_ABI,
        functionName: "initialize",
        args: [key, sqrtPriceX96],
      });
      res.json({
        to: V4_POOL_MANAGER,
        data,
        value: "0",
        poolKey: { ...key, sqrtPriceX96: sqrtPriceX96.toString() },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "calldata failed";
      logger.warn({ err }, "POST /api/pools/create/calldata failed");
      res.status(400).json({ error: message, code: "POOL_CREATE_INVALID" });
    }
  },
);

const recordSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  tokenA: z.string().refine(isTokenSymbol),
  tokenB: z.string().refine(isTokenSymbol),
  fee: z.number().int().refine(isFeeTier),
  outcome: z.enum(["success", "failure"]),
});

poolCreateRouter.post(
  "/api/pools/create/record",
  writeRateLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = recordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", code: "BAD_REQUEST" });
      return;
    }
    const ctx = getRequestContext(req);
    const { txHash, tokenA, tokenB, fee, outcome } = parsed.data;
    const { key } = buildPoolKey(tokenA, tokenB, fee);
    const poolKeyHash = keccak256(
      toHex(`${key.currency0}|${key.currency1}|${String(fee)}|${String(key.tickSpacing)}|${key.hooks}`),
    );

    if (outcome === "success") {
      try {
        await db.insert(poolsTable).values({
          poolKeyHash,
          token0: getToken(tokenA).address,
          token1: getToken(tokenB).address,
          fee,
          tickSpacing: key.tickSpacing,
          hookAddress: key.hooks,
          hookType: "none",
          createdTx: txHash,
        });
      } catch (err) {
        logger.warn({ err, poolKeyHash }, "pools insert failed (likely duplicate)");
      }
    }
    await logAudit({
      ...ctx,
      action: "create_pool",
      outcome,
      txHash,
      params: { tokenA, tokenB, fee, poolKeyHash },
    });
    res.json({ ok: true, poolKeyHash });
  },
);

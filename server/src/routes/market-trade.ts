import { Router, type Request, type Response } from "express";
import { parseAbi } from "viem";
import { z } from "zod";
import { logger } from "../lib/logger.ts";
import { requireAuth } from "../middleware/auth.ts";
import { writeRateLimiter } from "../middleware/rate-limit.ts";
import { baseRpcClient } from "../lib/rpc-client.ts";
import { computeMarketId } from "../lib/market-id.ts";
import { buildPoolSwapTestCalldata } from "../lib/v4-onchain-swap.ts";
import { DYNAMIC_MARKET_ARC } from "../lib/v4-contracts.ts";
import {
  MARKETS_ARC,
  MARKETS_PERIPHERY_ARC,
  MARKET_ABI,
  MARKET_FACTORY_ABI,
} from "../lib/markets-contracts.ts";
import { planMarketPool } from "../lib/sports/market-pool.ts";

export const marketTradeRouter = Router();

const V4_QUOTER_ABI = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "struct QuoteExactSingleParams { PoolKey poolKey; bool zeroForOne; uint128 exactAmount; bytes hookData; }",
  "function quoteExactInputSingle(QuoteExactSingleParams params) returns (uint256 amountOut, uint256 gasEstimate)",
]);

const bodySchema = z.object({
  providerEventId: z.string().min(1).max(32),
  /** 0 = home market, 1 = away market — whose YES the user is buying. */
  outcomeIndex: z.union([z.literal(0), z.literal(1)]),
  /** "buy" spends USDC for YES; "sell" spends YES for USDC. */
  direction: z.enum(["buy", "sell"]).default("buy"),
  /** Exact input in raw units (6dp): USDC for buys, YES tokens for sells. */
  amountRaw: z
    .string()
    .regex(/^\d+$/)
    .refine((v) => BigInt(v) > 0n && BigInt(v) <= 100_000_000_000n, {
      message: "amount out of range",
    }),
});

/**
 * POST /api/markets/trade/calldata — quote + calldata for one outcome-token
 * trade (B7-003, DM-112 direct leg).
 *
 * The server builds, the USER signs: this route holds no keys and moves no
 * funds. It resolves the game's market, quotes the swap through the market
 * stack's V4Quoter, and returns PoolSwapTest calldata for the client's
 * wallet — the same to/data/value/approvalTarget contract as the existing
 * v4 swap route, so the client execution path is shared.
 */
marketTradeRouter.post(
  "/api/markets/trade/calldata",
  requireAuth,
  writeRateLimiter,
  async (req: Request, res: Response) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid trade", code: "BAD_REQUEST", details: parsed.error.issues });
      return;
    }
    const { providerEventId, outcomeIndex, direction, amountRaw } = parsed.data;

    try {
      const marketId = computeMarketId({ providerEventId, marketType: "moneyline", outcomeIndex });
      const marketAddress = await baseRpcClient.readContract({
        address: MARKETS_ARC.factory,
        abi: MARKET_FACTORY_ABI,
        functionName: "marketOf",
        args: [marketId],
      });
      if (marketAddress === "0x0000000000000000000000000000000000000000") {
        res.status(404).json({ error: "No market for this game yet", code: "NO_MARKET" });
        return;
      }
      const yesToken = await baseRpcClient.readContract({
        address: marketAddress,
        abi: MARKET_ABI,
        functionName: "yesToken",
      });
      const plan = planMarketPool(yesToken, MARKETS_ARC.collateral, DYNAMIC_MARKET_ARC.hook, 0.5);

      // Buy = input USDC; sell = input YES. zeroForOne is "input is token0".
      const inputIsYes = direction === "sell";
      const zeroForOne = inputIsYes ? plan.yesIsToken0 : !plan.yesIsToken0;
      const amountIn = BigInt(amountRaw);

      const { result } = await baseRpcClient.simulateContract({
        address: MARKETS_PERIPHERY_ARC.quoter,
        abi: V4_QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [{ poolKey: plan.key, zeroForOne, exactAmount: amountIn, hookData: "0x" }],
      });
      const [amountOut] = result;

      const calldata = buildPoolSwapTestCalldata({
        poolKey: plan.key,
        zeroForOne,
        amountInRaw: amountIn,
      });

      // Effective YES price in USDC bps — buys: usdcIn/yesOut; sells: usdcOut/yesIn.
      const usdc = direction === "buy" ? amountIn : amountOut;
      const yes = direction === "buy" ? amountOut : amountIn;
      const effectivePriceBps = yes > 0n ? Number((usdc * 10_000n) / yes) : null;

      res.json({
        ...calldata,
        marketId,
        marketAddress,
        yesToken,
        inputToken: inputIsYes ? yesToken : MARKETS_ARC.collateral,
        quote: {
          amountIn: amountIn.toString(),
          amountOut: amountOut.toString(),
          effectivePriceBps,
        },
      });
    } catch (err) {
      logger.warn({ err, providerEventId }, "market-trade: quote failed");
      res.status(502).json({
        error: "Couldn't quote this trade — the pool may lack liquidity at this size.",
        code: "QUOTE_FAILED",
      });
    }
  },
);

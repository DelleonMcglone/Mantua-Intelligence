import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { logger } from "../lib/logger.ts";
import { isTokenSymbol, type TokenSymbol } from "../lib/tokens.ts";
import {
  buildPoolSwapTestCalldata,
  findMaxQuotableInputV4,
  quoteExactInputV4,
} from "../lib/v4-onchain-swap.ts";
import { HOOK_NAMES, isFeeTier } from "../lib/v4-contracts.ts";
import { HookPairNotAllowedError } from "../lib/hook-pair-gating.ts";
import { requireAuth } from "../middleware/auth.ts";
import { writeRateLimiter } from "../middleware/rate-limit.ts";

export const v4SwapRouter = Router();

const hookSchema = z.enum(HOOK_NAMES);

const baseSwapSchema = z.object({
  tokenIn: z.string().refine(isTokenSymbol, "Unknown tokenIn"),
  tokenOut: z.string().refine(isTokenSymbol, "Unknown tokenOut"),
  fee: z.number().int().refine(isFeeTier, "Fee tier must be 100/500/3000/10000"),
  hook: hookSchema.nullable().optional(),
  amountInRaw: z.string().regex(/^\d+$/, "amountInRaw must be a uint string"),
});

/**
 * Proof-of-concept testnet swap quote — calls v4-periphery's V4Quoter
 * directly via `eth_call` so users on Base Sepolia (where Uniswap's
 * Trading API has no index) still see a real expected output amount.
 *
 * Mainnet keeps using the existing `/api/quote` endpoint; this is a
 * parallel path so the production swap flow stays untouched.
 */
v4SwapRouter.post(
  "/api/v4/quote",
  writeRateLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = baseSwapSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request",
        code: "BAD_REQUEST",
        details: parsed.error.issues,
      });
      return;
    }
    const { tokenIn, tokenOut, fee, hook, amountInRaw } = parsed.data;
    if (tokenIn === tokenOut) {
      res.status(400).json({ error: "tokenIn and tokenOut must differ", code: "BAD_REQUEST" });
      return;
    }
    try {
      const quote = await quoteExactInputV4({
        tokenIn: tokenIn as TokenSymbol,
        tokenOut: tokenOut as TokenSymbol,
        fee,
        hook: hook ?? null,
        amountInRaw: BigInt(amountInRaw),
      });
      res.json(quote);
    } catch (err) {
      if (err instanceof HookPairNotAllowedError) {
        res.status(400).json({ error: err.message, code: "HOOK_PAIR_NOT_ALLOWED" });
        return;
      }
      logger.warn({ err, tokenIn, tokenOut, hook }, "v4 onchain quote failed");
      const message = err instanceof Error ? err.message : "Quote failed";
      res.status(502).json({ error: message, code: "V4_QUOTE_FAILED" });
    }
  },
);

const maxInputSchema = z.object({
  tokenIn: z.string().refine(isTokenSymbol, "Unknown tokenIn"),
  tokenOut: z.string().refine(isTokenSymbol, "Unknown tokenOut"),
  fee: z.number().int().refine(isFeeTier, "Fee tier must be 100/500/3000/10000"),
  hook: hookSchema.nullable().optional(),
  /** User's wallet balance for `tokenIn`, in raw base units. Search
   *  caps at this value — anything bigger isn't useful since the user
   *  can't spend it anyway. */
  upperBoundRaw: z.string().regex(/^\d+$/, "upperBoundRaw must be a uint string"),
});

/**
 * Largest input amount V4Quoter accepts for the given pool key,
 * bounded by the user's wallet balance. Used by the swap panel's
 * percent chips so 25% / 50% / Max can't overshoot pool depth.
 *
 * Binary-searched on-chain — each request fires up to 25 `eth_call`s
 * to V4Quoter, so don't poll this. The client fires it once per pair
 * + fee + hook change.
 */
v4SwapRouter.post(
  "/api/v4/swap/max-input",
  writeRateLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = maxInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request",
        code: "BAD_REQUEST",
        details: parsed.error.issues,
      });
      return;
    }
    const { tokenIn, tokenOut, fee, hook, upperBoundRaw } = parsed.data;
    if (tokenIn === tokenOut) {
      res.status(400).json({ error: "tokenIn and tokenOut must differ", code: "BAD_REQUEST" });
      return;
    }
    try {
      const max = await findMaxQuotableInputV4({
        tokenIn: tokenIn as TokenSymbol,
        tokenOut: tokenOut as TokenSymbol,
        fee,
        hook: hook ?? null,
        upperBound: BigInt(upperBoundRaw),
      });
      res.json({ maxInputRaw: max.toString() });
    } catch (err) {
      logger.warn({ err, tokenIn, tokenOut, hook }, "v4 max-input search failed");
      res.json({ maxInputRaw: "0" });
    }
  },
);

const calldataSchema = baseSwapSchema.extend({
  /** Slippage tolerance in bps. Used to derive `amountOutMinimum` for
   *  the client to enforce. */
  slippageBps: z.number().int().min(0).max(10_000).default(50),
});

/**
 * POC testnet swap calldata — re-runs the quote (so the response
 * carries an `amountOutMinimum` derived from the same on-chain
 * simulation, not stale client state) and returns the
 * `PoolSwapTest.swap` calldata. The client either approves the input
 * ERC-20 to `approvalTarget` first or, for native-ETH input, attaches
 * `value` and skips the approval.
 */
v4SwapRouter.post(
  "/api/v4/swap/calldata",
  writeRateLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = calldataSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request",
        code: "BAD_REQUEST",
        details: parsed.error.issues,
      });
      return;
    }
    const { tokenIn, tokenOut, fee, hook, amountInRaw, slippageBps } = parsed.data;
    if (tokenIn === tokenOut) {
      res.status(400).json({ error: "tokenIn and tokenOut must differ", code: "BAD_REQUEST" });
      return;
    }
    try {
      const quote = await quoteExactInputV4({
        tokenIn: tokenIn as TokenSymbol,
        tokenOut: tokenOut as TokenSymbol,
        fee,
        hook: hook ?? null,
        amountInRaw: BigInt(amountInRaw),
      });
      const swap = buildPoolSwapTestCalldata({
        poolKey: quote.poolKey,
        zeroForOne: quote.zeroForOne,
        amountInRaw: BigInt(amountInRaw),
      });
      // amountOutMinimum: amountOut * (1 - slippage)
      const slippageDenom = 10_000n;
      const minOut =
        (BigInt(quote.amountOut) * (slippageDenom - BigInt(slippageBps))) / slippageDenom;
      res.json({
        ...swap,
        quote: {
          amountIn: quote.amountIn,
          amountOut: quote.amountOut,
          amountOutMinimum: minOut.toString(),
          gasEstimate: quote.gasEstimate,
          poolKey: quote.poolKey,
          zeroForOne: quote.zeroForOne,
        },
      });
    } catch (err) {
      if (err instanceof HookPairNotAllowedError) {
        res.status(400).json({ error: err.message, code: "HOOK_PAIR_NOT_ALLOWED" });
        return;
      }
      logger.warn({ err, tokenIn, tokenOut, hook }, "v4 swap calldata failed");
      const message = err instanceof Error ? err.message : "Swap calldata failed";
      res.status(502).json({ error: message, code: "V4_SWAP_FAILED" });
    }
  },
);

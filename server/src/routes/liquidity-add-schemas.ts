import { z } from "zod";
import { isTokenSymbol } from "../lib/tokens.ts";
import { isFeeTier } from "../lib/v4-contracts.ts";

export const calldataSchema = z.object({
  tokenA: z.string().refine(isTokenSymbol, "Unknown tokenA"),
  tokenB: z.string().refine(isTokenSymbol, "Unknown tokenB"),
  fee: z.number().int().refine(isFeeTier, "Fee tier must be 100/500/3000/10000"),
  amountARaw: z.string().regex(/^\d+$/),
  amountBRaw: z.string().regex(/^\d+$/),
  sqrtPriceX96: z.string().regex(/^\d+$/),
  slippageBps: z.number().int().min(0).max(500).default(50),
  deadlineSeconds: z.number().int().positive(),
});

export const recordSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  tokenA: z.string().refine(isTokenSymbol),
  tokenB: z.string().refine(isTokenSymbol),
  fee: z.number().int().refine(isFeeTier),
  amountARaw: z.string().regex(/^\d+$/),
  amountBRaw: z.string().regex(/^\d+$/),
  liquidity: z.string().regex(/^\d+$/),
  tickLower: z.number().int(),
  tickUpper: z.number().int(),
  poolKeyHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  /** PositionManager NFT token id minted on success — extracted from
   *  Transfer event in the receipt. Null when outcome=failure. */
  tokenId: z.string().regex(/^\d+$/).nullable().optional(),
  /** Snapshot of the pool's sqrtPriceX96 at mint — used as the price
   *  reference for the remove preview until subgraph indexing lands. */
  sqrtPriceX96: z.string().regex(/^\d+$/).optional(),
  outcome: z.enum(["success", "failure"]),
});

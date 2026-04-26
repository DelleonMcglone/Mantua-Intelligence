import { z } from "zod";

export const calldataSchema = z.object({
  positionId: z.string().uuid(),
  /** Percentage 1..100 (whole numbers). */
  percentage: z.number().int().min(1).max(100),
  /** Caller-supplied snapshot of the pool's current sqrtPrice. */
  sqrtPriceX96: z.string().regex(/^\d+$/),
  slippageBps: z.number().int().min(0).max(500).default(50),
  deadlineSeconds: z.number().int().positive(),
});

export const recordSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  positionId: z.string().uuid(),
  liquidityRemoved: z.string().regex(/^\d+$/),
  isFullExit: z.boolean(),
  outcome: z.enum(["success", "failure"]),
});

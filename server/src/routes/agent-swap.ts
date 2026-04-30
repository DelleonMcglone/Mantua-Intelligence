import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { swapFromAgentWallet } from "../lib/agent-swap.ts";
import { AgentWalletNotFoundError } from "../lib/agent-wallet.ts";
import { logAudit } from "../lib/audit.ts";
import { CdpUnavailableError } from "../lib/cdp/client.ts";
import { SafetyError } from "../lib/errors.ts";
import { logger } from "../lib/logger.ts";
import { getRequestContext } from "../lib/request-context.ts";
import { isTokenSymbol } from "../lib/tokens.ts";
import { requireAuth } from "../middleware/auth.ts";
import { writeRateLimiter } from "../middleware/rate-limit.ts";

export const agentSwapRouter = Router();

const swapSchema = z.object({
  tokenIn: z.string().refine(isTokenSymbol, "Unsupported tokenIn on this network"),
  tokenOut: z.string().refine(isTokenSymbol, "Unsupported tokenOut on this network"),
  amountIn: z.string().regex(/^\d+(\.\d+)?$/, "amountIn must be a positive decimal string"),
  /** Optional fractional-percent slippage (e.g. 0.5 = 0.5%). */
  slippageTolerance: z.number().positive().max(5).optional(),
});

agentSwapRouter.post(
  "/api/agent/swap",
  writeRateLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    const privyUserId = req.privyUserId;
    if (!privyUserId) {
      res.status(401).json({ error: "Authentication required.", code: "UNAUTHENTICATED" });
      return;
    }
    const parsed = swapSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request",
        code: "BAD_REQUEST",
        details: parsed.error.issues,
      });
      return;
    }
    const ctx = getRequestContext(req);
    const { tokenIn, tokenOut, amountIn, slippageTolerance } = parsed.data;
    try {
      const result = await swapFromAgentWallet({
        privyUserId,
        tokenIn,
        tokenOut,
        amountIn,
        ...(slippageTolerance !== undefined ? { slippageTolerance } : {}),
      });
      await logAudit({
        ...ctx,
        action: "agent_swap",
        outcome: "success",
        txHash: result.txHash,
        params: {
          agentAddress: result.agentAddress,
          tokenIn,
          tokenOut,
          amountInRaw: result.amountInRaw,
          amountOutRaw: result.amountOutRaw,
          usdValue: result.usdValue,
          network: result.network,
        },
      });
      res.json(result);
    } catch (err) {
      if (err instanceof AgentWalletNotFoundError) {
        res.status(404).json({ error: err.message, code: "AGENT_WALLET_NOT_FOUND" });
        return;
      }
      if (err instanceof SafetyError) {
        res.status(403).json({ error: err.message, code: err.code, details: err.details });
        return;
      }
      if (err instanceof CdpUnavailableError) {
        res.status(503).json({ error: err.message, code: "CDP_UNAVAILABLE" });
        return;
      }
      logger.error({ err }, "agent swap failed");
      await logAudit({
        ...ctx,
        action: "agent_swap",
        outcome: "failure",
        params: { tokenIn, tokenOut, amountIn },
        reason: err instanceof Error ? err.message : "unknown",
      });
      // Upstream Uniswap Trading API or CDP / RPC errors land here.
      res.status(502).json({
        error: "Swap failed at the upstream Trading API or CDP/RPC layer.",
        code: "UPSTREAM_FAILURE",
      });
    }
  },
);

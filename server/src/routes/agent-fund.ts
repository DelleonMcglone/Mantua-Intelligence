import { Router, type Request, type Response } from "express";
import { fundAgentWallet } from "../lib/agent-fund.ts";
import { AgentWalletNotFoundError } from "../lib/agent-wallet.ts";
import { logAudit } from "../lib/audit.ts";
import { CircleUnavailableError } from "../lib/circle/client.ts";
import { logger } from "../lib/logger.ts";
import { getRequestContext } from "../lib/request-context.ts";
import { requireAuth } from "../middleware/auth.ts";
import { writeRateLimiter } from "../middleware/rate-limit.ts";

export const agentFundRouter = Router();

agentFundRouter.post(
  "/api/agent/fund",
  writeRateLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    const privyUserId = req.privyUserId;
    if (!privyUserId) {
      res.status(401).json({ error: "Authentication required.", code: "UNAUTHENTICATED" });
      return;
    }
    const ctx = getRequestContext(req);
    try {
      const result = await fundAgentWallet(privyUserId);
      await logAudit({
        ...ctx,
        action: "agent_wallet_fund",
        outcome: "success",
        params: { agentAddress: result.agentAddress, blockchain: result.blockchain },
      });
      res.json(result);
    } catch (err) {
      if (err instanceof AgentWalletNotFoundError) {
        res.status(404).json({ error: err.message, code: "AGENT_WALLET_NOT_FOUND" });
        return;
      }
      if (err instanceof CircleUnavailableError) {
        res.status(503).json({ error: err.message, code: "CIRCLE_UNAVAILABLE" });
        return;
      }
      logger.error({ err }, "agent fund failed");
      res.status(502).json({
        error:
          "Faucet request failed — Circle's testnet faucet may require a mainnet-upgraded account. Fund the agent address manually via the Arc testnet faucet.",
        code: "FAUCET_FAILED",
      });
    }
  },
);

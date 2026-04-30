import { Router, type Request, type Response } from "express";
import type { AgentWallet } from "../db/schema/agent.ts";
import { getAgentWallet, getOrCreateAgentWallet, UserNotFoundError } from "../lib/agent-wallet.ts";
import { logAudit } from "../lib/audit.ts";
import { CdpUnavailableError } from "../lib/cdp/client.ts";
import { logger } from "../lib/logger.ts";
import { getRequestContext } from "../lib/request-context.ts";
import { requireAuth } from "../middleware/auth.ts";
import { walletRateLimiter, writeRateLimiter } from "../middleware/rate-limit.ts";

export const agentWalletsRouter = Router();

interface AgentWalletDto {
  address: string;
  cdpWalletId: string;
  label: string | null;
  dailyCapUsd: string;
  status: string;
  createdAt: string;
}

function toDto(w: AgentWallet): AgentWalletDto {
  return {
    address: w.address,
    cdpWalletId: w.cdpWalletId,
    label: w.label,
    dailyCapUsd: w.dailyCapUsd,
    status: w.status,
    createdAt: w.createdAt.toISOString(),
  };
}

agentWalletsRouter.post(
  "/api/agent/wallet",
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
      const wallet = await getOrCreateAgentWallet(privyUserId);
      await logAudit({
        ...ctx,
        action: "agent_wallet_provision",
        outcome: "success",
        params: { agentAddress: wallet.address, cdpWalletId: wallet.cdpWalletId },
      });
      res.json(toDto(wallet));
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        res.status(409).json({
          error: "Connect your primary wallet first — no user record exists yet.",
          code: "USER_NOT_FOUND",
        });
        return;
      }
      if (err instanceof CdpUnavailableError) {
        res.status(503).json({ error: err.message, code: "CDP_UNAVAILABLE" });
        return;
      }
      logger.error({ err }, "agent wallet provision failed");
      await logAudit({
        ...ctx,
        action: "agent_wallet_provision",
        outcome: "failure",
        reason: err instanceof Error ? err.message : "unknown",
      });
      res.status(500).json({ error: "Failed to provision agent wallet", code: "INTERNAL" });
    }
  },
);

agentWalletsRouter.get(
  "/api/agent/wallet",
  walletRateLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    const privyUserId = req.privyUserId;
    if (!privyUserId) {
      res.status(401).json({ error: "Authentication required.", code: "UNAUTHENTICATED" });
      return;
    }
    const wallet = await getAgentWallet(privyUserId);
    if (!wallet) {
      res.status(404).json({
        error: "No agent wallet provisioned for this user.",
        code: "NOT_FOUND",
      });
      return;
    }
    res.json(toDto(wallet));
  },
);

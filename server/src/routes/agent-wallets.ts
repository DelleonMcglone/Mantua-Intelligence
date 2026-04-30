import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { AgentWallet } from "../db/schema/agent.ts";
import {
  AgentWalletNotFoundError,
  getAgentWallet,
  getOrCreateAgentWallet,
  updateAgentWalletCap,
  UserNotFoundError,
} from "../lib/agent-wallet.ts";
import { logAudit } from "../lib/audit.ts";
import { CdpUnavailableError } from "../lib/cdp/client.ts";
import { HARD_DAILY_CAP_USD } from "../lib/constants.ts";
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

const updateCapSchema = z.object({
  dailyCapUsd: z.number().nonnegative().max(HARD_DAILY_CAP_USD),
});

/**
 * P6-011 — set the agent wallet's daily USD spending cap. Per-wallet (not
 * per-user) by design, so the agent's blast radius is bounded
 * independently of the user's primary wallet cap (D-008 / P1-001).
 * The cap is enforced in `server/src/lib/spending-cap.ts:checkSpendingCap`
 * which already routes agent-wallet addresses through `agent_wallets`.
 * Range: 0 ≤ dailyCapUsd ≤ HARD_DAILY_CAP_USD ($50k absolute ceiling
 * shared with the user wallet — set in code, not at runtime).
 */
agentWalletsRouter.patch(
  "/api/agent/wallet/cap",
  writeRateLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    const privyUserId = req.privyUserId;
    if (!privyUserId) {
      res.status(401).json({ error: "Authentication required.", code: "UNAUTHENTICATED" });
      return;
    }
    const parsed = updateCapSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request",
        code: "BAD_REQUEST",
        details: parsed.error.issues,
      });
      return;
    }
    const ctx = getRequestContext(req);
    try {
      const wallet = await updateAgentWalletCap(privyUserId, parsed.data.dailyCapUsd);
      await logAudit({
        ...ctx,
        action: "agent_wallet_cap_update",
        outcome: "success",
        params: { agentAddress: wallet.address, dailyCapUsd: wallet.dailyCapUsd },
      });
      res.json(toDto(wallet));
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        res.status(409).json({ error: err.message, code: "USER_NOT_FOUND" });
        return;
      }
      if (err instanceof AgentWalletNotFoundError) {
        res.status(404).json({ error: err.message, code: "AGENT_WALLET_NOT_FOUND" });
        return;
      }
      logger.error({ err }, "agent wallet cap update failed");
      await logAudit({
        ...ctx,
        action: "agent_wallet_cap_update",
        outcome: "failure",
        reason: err instanceof Error ? err.message : "unknown",
      });
      res.status(500).json({ error: "Failed to update agent wallet cap", code: "INTERNAL" });
    }
  },
);

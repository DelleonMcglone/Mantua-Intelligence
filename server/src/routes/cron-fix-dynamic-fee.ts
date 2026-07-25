import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger.ts";
import { repairDynamicFeePools, DfRepairUnavailableError } from "../lib/df-repair.ts";
import { requireCronSecret } from "../middleware/cron-auth.ts";

export const cronFixDynamicFeeRouter = Router();

/**
 * GET /api/cron/fix-dynamic-fee — TEMPORARY one-off maintenance: re-price and
 * seed the DynamicFee USDC/cirBTC pools (see lib/df-repair.ts). Cron-secret
 * gated like the other keeper routes; idempotent, so a repeat call after the
 * repair just reports "skipped" steps. NOT registered in vercel.json crons —
 * trigger manually (GitHub Actions dispatch). Remove after the repair runs.
 */
cronFixDynamicFeeRouter.get(
  "/api/cron/fix-dynamic-fee",
  requireCronSecret,
  async (_req: Request, res: Response) => {
    try {
      const result = await repairDynamicFeePools();
      logger.info({ result }, "df-repair complete");
      res.json(result);
    } catch (err) {
      if (err instanceof DfRepairUnavailableError) {
        res.status(503).json({ error: err.message, code: "DF_REPAIR_DISABLED" });
        return;
      }
      logger.error({ err }, "df-repair failed");
      res.status(500).json({
        error: err instanceof Error ? err.message : "DynamicFee repair failed",
        code: "DF_REPAIR_FAILED",
      });
    }
  },
);

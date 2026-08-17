import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger.ts";
import { EspnProvider } from "../lib/sports/espn.ts";
import { planResolution } from "../lib/sports/resolution.ts";
import type { LeagueSlug } from "../lib/sports/provider.ts";
import { requireCronSecret } from "../middleware/cron-auth.ts";

export const cronResolutionRouter = Router();

const espn = new EspnProvider();
const LEAGUES: readonly LeagueSlug[] = ["nfl", "wnba"];

/**
 * GET /api/cron/resolution — B4-003's settlement sweep.
 *
 * Reads each covered league's slate, plans freezes / resolves / voids, and —
 * once the Resolver contract is deployed and a signer configured — executes
 * them via `executeResolution` and records each action in the `resolutions`
 * table (B4-006).
 *
 * **Currently always a dry run, and deliberately loud about it.** The
 * on-chain submitter needs the deployed Resolver's address (B2-005 broadcast
 * still pending) and a signer key that must live in an encrypted keystore,
 * not env — see deploy/dynamic-market/README.md. Until both exist this route
 * returns 503 RESOLUTION_DISABLED so cron monitoring treats settlement as
 * down rather than silently succeeding at nothing. The computed plan rides
 * along in the body so operators can see what *would* have settled.
 *
 * The secondary provider is null until DM-107's vendor is chosen; with no
 * secondary configured, `decideSettlement`'s guards alone govern (its
 * corroboration policy activates the moment one is wired in).
 */
cronResolutionRouter.get(
  "/api/cron/resolution",
  requireCronSecret,
  async (_req: Request, res: Response) => {
    const plans: Record<string, unknown> = {};

    for (const league of LEAGUES) {
      try {
        const slate = await espn.getSlate(league);
        const plan = planResolution(slate, null);
        plans[league] = {
          delayed: slate.delayed,
          freezes: plan.freezes.length,
          resolves: plan.submissions.filter((s) => s.kind === "resolve").length,
          voids: plan.submissions.filter((s) => s.kind === "void").length,
          held: plan.held,
        };
      } catch (err) {
        logger.error({ league, err }, "resolution: planning failed");
        plans[league] = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    res.status(503).json({
      error: "Resolution submission is not configured — Resolver contract not yet deployed",
      code: "RESOLUTION_DISABLED",
      dryRun: plans,
    });
  },
);

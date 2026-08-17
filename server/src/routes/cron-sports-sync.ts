import { Router, type Request, type Response } from "express";
import { db } from "../db/client.ts";
import { logger } from "../lib/logger.ts";
import { EspnProvider } from "../lib/sports/espn.ts";
import { refreshSlate } from "../lib/sports/ingest.ts";
import { upsertEvents } from "../lib/sports/store.ts";
import type { LeagueSlug } from "../lib/sports/provider.ts";
import { requireCronSecret } from "../middleware/cron-auth.ts";

export const cronSportsSyncRouter = Router();

/** One provider instance so the breaker and cache state survive across runs. */
const espn = new EspnProvider();

/** The covered leagues, per DM-105. Promotion is a data change elsewhere. */
const LEAGUES: readonly LeagueSlug[] = ["nfl", "wnba"];

/**
 * GET /api/cron/sports-sync — B3-005's slate-refresh pass. For each covered
 * league: fetch the slate through the resilient ESPN adapter, upsert the
 * normalized events, and report the markets the generator says should exist.
 *
 * GET because Vercel Cron uses GET; guarded by the shared cron secret.
 *
 * **This route plans markets; it does not create them.** On-chain creation
 * needs the deployed MarketFactory (B2-005 is still awaiting a funded deployer
 * key), and keeping the worker signature-free means a parsing bug can never
 * mint a market. The `marketsPlanned` counts in the response are what the
 * creation step will act on once the factory exists.
 *
 * Failure isolation is per league: NFL being down must not stop WNBA syncing,
 * so each league catches independently and reports its own error.
 */
cronSportsSyncRouter.get(
  "/api/cron/sports-sync",
  requireCronSecret,
  async (_req: Request, res: Response) => {
    const results: Record<string, unknown> = {};
    let failures = 0;

    for (const league of LEAGUES) {
      try {
        const refresh = await refreshSlate(espn, league);
        const persisted = await upsertEvents(db, refresh.provider, league, refresh.events);

        results[league] = {
          provider: refresh.provider,
          delayed: refresh.delayed,
          eventsSeen: refresh.events.length,
          inserted: persisted.inserted,
          updated: persisted.updated,
          sideConflicts: persisted.sideConflicts,
          marketsPlanned: refresh.marketsPlanned.length,
        };
      } catch (err) {
        failures += 1;
        logger.error({ league, err }, "sports-sync: league failed");
        results[league] = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    res.status(failures === LEAGUES.length ? 502 : 200).json({
      ok: failures < LEAGUES.length,
      breakers: espn.breakerState(),
      leagues: results,
    });
  },
);

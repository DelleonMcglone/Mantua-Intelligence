import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger.ts";
import { EspnProvider } from "../lib/sports/espn.ts";
import { toPublicSlate, type PublicSlate } from "../lib/sports/public-slate.ts";
import type { LeagueSlug } from "../lib/sports/provider.ts";

export const sportsSlateRouter = Router();

const espn = new EspnProvider();
const LEAGUES: readonly LeagueSlug[] = ["nfl", "wnba"];

function isLeague(value: unknown): value is LeagueSlug {
  return typeof value === "string" && (LEAGUES as readonly string[]).includes(value);
}

/**
 * GET /api/sports/slate[?league=nfl] — today's games for the board and the
 * per-league market pages (B5-001..003).
 *
 * Public and unauthenticated by design: browsing is free, only transactions
 * need a login (B5-007). The global per-IP limiter covers abuse; the
 * provider's own TTL cache means a burst of board loads costs one upstream
 * fetch. Responses pass through `toPublicSlate`, so provider strings are
 * scrubbed and only whitelisted fields leave (B8-008).
 *
 * A league whose fetch fails reports `error` for that league while the others
 * still render — one upstream outage must not blank the whole board.
 */
sportsSlateRouter.get("/api/sports/slate", async (req: Request, res: Response) => {
  const requested = req.query.league;
  if (requested !== undefined && !isLeague(requested)) {
    res.status(400).json({ error: "Unknown league", code: "BAD_LEAGUE" });
    return;
  }
  const leagues = requested !== undefined && isLeague(requested) ? [requested] : LEAGUES;

  const slates: Record<string, PublicSlate | { error: string }> = {};
  await Promise.all(
    leagues.map(async (league) => {
      try {
        slates[league] = toPublicSlate(await espn.getSlate(league));
      } catch (err) {
        logger.warn({ league, err }, "sports-slate: fetch failed");
        slates[league] = { error: "Slate temporarily unavailable" };
      }
    }),
  );

  // Short shared cache: live scores move fast, but a 15s CDN hit still
  // collapses a stampede of board loads into one origin request.
  res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=30");
  res.json({ leagues: slates });
});

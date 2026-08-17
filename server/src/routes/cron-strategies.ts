import { Router, type Request, type Response } from "express";
import { db } from "../db/client.ts";
import { env } from "../env.ts";
import { logger } from "../lib/logger.ts";
import { EspnProvider } from "../lib/sports/espn.ts";
import {
  evaluateStrategy,
  strategyConfigSchema,
  ticksFromSlates,
  type ArmedStrategy,
} from "../lib/sports/strategies.ts";
import { engineDisarm, engineTrigger, listArmed } from "../lib/sports/strategy-store.ts";
import type { LeagueSlug } from "../lib/sports/provider.ts";
import { requireCronSecret } from "../middleware/cron-auth.ts";

export const cronStrategiesRouter = Router();

const espn = new EspnProvider();
const LEAGUES: readonly LeagueSlug[] = ["nfl", "wnba"];

/**
 * GET /api/cron/strategies — B9-005's evaluation tick.
 *
 * Loads every armed strategy, builds market ticks from the (non-delayed)
 * slates, and applies `evaluateStrategy`'s decisions: auto-disarms persist
 * immediately (B9-007 — kickoff freeze, resolution, expiry, kill switch);
 * triggers persist as `triggered` with a full audit row.
 *
 * **Execution is held**: closing a position means swapping outcome tokens,
 * which needs the v4 periphery on the market PoolManager (not yet
 * deployed). A triggered strategy therefore records exactly what it wanted
 * to do and waits — it does not guess at a venue. The executor slots in
 * behind `engineTrigger` when the periphery lands, inside the agent
 * wallet's policy caps (B8-010).
 */
cronStrategiesRouter.get(
  "/api/cron/strategies",
  requireCronSecret,
  async (_req: Request, res: Response) => {
    const killed = env.STRATEGIES_KILL_SWITCH;
    const now = Math.floor(Date.now() / 1000);

    let armed;
    try {
      armed = await listArmed(db);
    } catch (err) {
      logger.error({ err }, "strategies: load failed");
      res.status(500).json({ error: "Failed to load strategies", code: "INTERNAL" });
      return;
    }
    if (armed.length === 0) {
      res.json({ ok: true, armed: 0, killed, decisions: [] });
      return;
    }

    const slates = [];
    for (const league of LEAGUES) {
      try {
        slates.push(await espn.getSlate(league));
      } catch (err) {
        logger.warn({ league, err }, "strategies: slate fetch failed");
      }
    }
    const ticks = ticksFromSlates(slates, now);

    const decisions: Record<string, unknown>[] = [];
    for (const row of armed) {
      const parsed = strategyConfigSchema.safeParse(row.config);
      if (!parsed.success) {
        // A stored config this code can no longer parse must not stay armed.
        await engineDisarm(db, row.id, "config-unparseable");
        decisions.push({ id: row.id, decision: "disarm", reason: "config-unparseable" });
        continue;
      }
      const strategy: ArmedStrategy = {
        id: row.id,
        config: parsed.data,
        capUsd: Number(row.capUsd),
        expiresAtSeconds: row.expiresAt ? Math.floor(row.expiresAt.getTime() / 1000) : null,
      };
      const decision = evaluateStrategy(strategy, ticks, now, killed);
      if (decision.kind === "disarm") {
        await engineDisarm(db, row.id, decision.reason);
      } else if (decision.kind === "trigger") {
        await engineTrigger(
          db,
          row.id,
          { action: decision.action, marketId: decision.marketId, deltaUsd: decision.deltaUsd },
          `${decision.reason} — execution pending periphery deploy`,
        );
      }
      decisions.push({ id: row.id, decision: decision.kind, reason: decision.reason });
    }

    res.json({ ok: true, armed: armed.length, killed, decisions });
  },
);

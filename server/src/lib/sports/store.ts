/**
 * B3-004 — persist normalized provider events into the canonical `events`
 * rows, and keep the sport/league catalog rows they hang off.
 *
 * Everything here is an upsert keyed on `(provider, provider_event_id)` — the
 * unique constraint the schema carries precisely so that a slate refresh is
 * idempotent. Re-running the worker over the same slate updates timestamps and
 * scores; it can never duplicate a game (spec §3.1).
 *
 * One rule is enforced at this layer rather than left to callers: **home and
 * away are written once and never flipped by an update.** The market id's
 * outcome index is derived from that assignment (docs/specs/market-id.md), so
 * a provider reordering teams mid-season must not silently invert what an
 * existing market's YES token means. If a provider ever *does* swap sides for
 * a known event, that is corruption to escalate, not data to apply.
 */

import { eq, and, sql } from "drizzle-orm";
import type { DB } from "../../db/client.ts";
import { events, leagues, markets, sports } from "../../db/schema/index.ts";
import type { OnChainMarketDetail } from "./markets-onchain.ts";
import { logger } from "../logger.ts";
import type { LeagueSlug, ProviderEvent } from "./provider.ts";

/** The catalog the covered leagues hang off. Mirrors DM-105. */
const CATALOG: Record<
  LeagueSlug,
  { sportSlug: string; sportName: string; leagueName: string; providerKey: string }
> = {
  nfl: {
    sportSlug: "football",
    sportName: "Football",
    leagueName: "NFL",
    providerKey: "football/nfl",
  },
  wnba: {
    sportSlug: "basketball",
    sportName: "Basketball",
    leagueName: "WNBA",
    providerKey: "basketball/wnba",
  },
};

/** Ensure the sport + league rows exist; return the league id. */
export async function ensureLeague(db: DB, slug: LeagueSlug): Promise<string> {
  const entry = CATALOG[slug];

  const existing = await db.query.leagues.findFirst({ where: eq(leagues.slug, slug) });
  if (existing) return existing.id;

  let sport = await db.query.sports.findFirst({ where: eq(sports.slug, entry.sportSlug) });
  sport ??= (
    await db
      .insert(sports)
      .values({ slug: entry.sportSlug, name: entry.sportName })
      .onConflictDoNothing()
      .returning()
  ).at(0);
  if (!sport) {
    // Conflict raced us — someone else inserted it between the check and now.
    sport = await db.query.sports.findFirst({ where: eq(sports.slug, entry.sportSlug) });
  }
  if (!sport) throw new Error(`could not ensure sport row for ${entry.sportSlug}`);

  const inserted = await db
    .insert(leagues)
    .values({
      sportId: sport.id,
      slug,
      name: entry.leagueName,
      coverage: "launch",
      providerKey: entry.providerKey,
    })
    .onConflictDoNothing()
    .returning();

  const league =
    inserted.at(0) ?? (await db.query.leagues.findFirst({ where: eq(leagues.slug, slug) }));
  if (!league) throw new Error(`could not ensure league row for ${slug}`);
  return league.id;
}

export interface UpsertResult {
  inserted: number;
  updated: number;
  /** Events whose home/away assignment contradicted the stored row. */
  sideConflicts: string[];
}

/** Upsert a batch of normalized events for one league (B3-004, B3-005). */
export async function upsertEvents(
  db: DB,
  provider: string,
  league: LeagueSlug,
  batch: readonly ProviderEvent[],
): Promise<UpsertResult> {
  const leagueId = await ensureLeague(db, league);
  const result: UpsertResult = { inserted: 0, updated: 0, sideConflicts: [] };

  for (const e of batch) {
    const existing = await db.query.events.findFirst({
      where: and(eq(events.provider, provider), eq(events.providerEventId, e.providerEventId)),
    });

    if (!existing) {
      await db
        .insert(events)
        .values({
          leagueId,
          provider,
          providerEventId: e.providerEventId,
          homeTeam: e.home.name,
          awayTeam: e.away.name,
          homeTeamKey: e.home.key,
          awayTeamKey: e.away.key,
          startsAt: new Date(e.startsAt * 1000),
          status: e.status === "unknown" ? "scheduled" : e.status,
          homeScore: e.homeScore ?? null,
          awayScore: e.awayScore ?? null,
          lastPolledAt: new Date(),
        })
        .onConflictDoNothing();
      result.inserted += 1;
      continue;
    }

    // Guard the outcome-index anchor: a flipped home/away on a known event
    // would invert what YES means for any market already minted against it.
    if (
      existing.homeTeamKey &&
      existing.awayTeamKey &&
      (existing.homeTeamKey !== e.home.key || existing.awayTeamKey !== e.away.key)
    ) {
      logger.error(
        { providerEventId: e.providerEventId, stored: existing.homeTeamKey, incoming: e.home.key },
        "sports: provider flipped home/away for a known event — refusing to update",
      );
      result.sideConflicts.push(e.providerEventId);
      continue;
    }

    await db
      .update(events)
      .set({
        // `unknown` never overwrites a real status: absence of information
        // must not roll a final back to scheduled (spec §3.5).
        ...(e.status !== "unknown" ? { status: e.status } : {}),
        homeScore: e.homeScore ?? existing.homeScore,
        awayScore: e.awayScore ?? existing.awayScore,
        startsAt: new Date(e.startsAt * 1000),
        lastPolledAt: new Date(),
        updatedAt: sql`now()`,
      })
      .where(eq(events.id, existing.id));
    result.updated += 1;
  }

  return result;
}

// ─── Market rows (B4-006 prerequisite) ──────────────────────────────────────

/**
 * Persist the markets the on-chain sweep touched. The `resolutions` log
 * FK-references `markets.market_id`, so a row must exist BEFORE settlement
 * can be recorded — this runs on every sync tick and is idempotent
 * (insert-or-update keyed on the deterministic market id).
 */
export async function upsertMarketRows(
  db: DB,
  provider: string,
  details: readonly OnChainMarketDetail[],
): Promise<number> {
  let written = 0;
  for (const d of details) {
    const eventRow = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.provider, provider), eq(events.providerEventId, d.providerEventId)))
      .limit(1);
    const eventId = eventRow.at(0)?.id;
    if (!eventId) continue; // event not ingested yet — next tick heals

    await db
      .insert(markets)
      .values({
        marketId: d.marketId,
        eventId,
        marketType: "moneyline",
        outcomeIndex: d.outcomeIndex,
        yesToken: d.yesToken,
        noToken: d.noToken,
        poolId: d.poolId,
        openingProbability: d.openingProbability.toFixed(5),
      })
      .onConflictDoUpdate({
        target: markets.marketId,
        set: {
          yesToken: d.yesToken,
          noToken: d.noToken,
          poolId: d.poolId,
          updatedAt: new Date(),
        },
      });
    written += 1;
  }
  return written;
}

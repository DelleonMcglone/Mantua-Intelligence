import { Router, type Request, type Response } from "express";
import { desc, eq, isNotNull } from "drizzle-orm";
import { parseAbi } from "viem";
import { z } from "zod";
import { db } from "../db/client.ts";
import { events, markets } from "../db/schema/index.ts";
import { logger } from "../lib/logger.ts";
import { requireAuth } from "../middleware/auth.ts";
import { baseRpcClient } from "../lib/rpc-client.ts";
import { MARKETS_ARC, MARKETS_PERIPHERY_ARC, STATE_VIEW_ABI } from "../lib/markets-contracts.ts";
import { sqrtPriceX96ToProbability } from "../lib/probability.ts";

export const marketPositionsRouter = Router();

const BALANCE_ABI = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);

export interface MarketPositionRow {
  marketId: string;
  label: string;
  state: string;
  startsAt: number;
  side: "yes" | "no";
  balance: string;
  /** Current implied probability of THIS side paying out, in bps. */
  impliedProbBps: number | null;
  /** Mark value in USDC raw units (6dp): balance × side probability. */
  valueRaw: string;
}

/**
 * GET /api/markets/positions?address=0x… — the caller's outcome-token
 * holdings across recent markets, marked at the live pool price (B6-009).
 *
 * Balances and prices are public chain data; auth is required anyway so
 * the endpoint can't be used to enumerate arbitrary wallets anonymously.
 * Entry price / realized P&L need indexed fills and arrive with trade
 * history; this reports live mark value.
 */
marketPositionsRouter.get(
  "/api/markets/positions",
  requireAuth,
  async (req: Request, res: Response) => {
    const address = z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .safeParse(req.query.address);
    if (!address.success) {
      res.status(400).json({ error: "address required", code: "BAD_REQUEST" });
      return;
    }
    const owner = address.data as `0x${string}`;

    try {
      const rows = await db
        .select({
          marketId: markets.marketId,
          outcomeIndex: markets.outcomeIndex,
          state: markets.state,
          yesToken: markets.yesToken,
          noToken: markets.noToken,
          poolId: markets.poolId,
          startsAt: events.startsAt,
          homeTeam: events.homeTeam,
          awayTeam: events.awayTeam,
        })
        .from(markets)
        .innerJoin(events, eq(markets.eventId, events.id))
        .where(isNotNull(markets.yesToken))
        .orderBy(desc(markets.createdAt))
        .limit(40);

      const positions: MarketPositionRow[] = [];
      await Promise.all(
        rows.map(async (row) => {
          if (!row.yesToken || !row.noToken) return;
          const [yesBal, noBal] = await Promise.all([
            baseRpcClient.readContract({
              address: row.yesToken as `0x${string}`,
              abi: BALANCE_ABI,
              functionName: "balanceOf",
              args: [owner],
            }),
            baseRpcClient.readContract({
              address: row.noToken as `0x${string}`,
              abi: BALANCE_ABI,
              functionName: "balanceOf",
              args: [owner],
            }),
          ]);
          if (yesBal === 0n && noBal === 0n) return;

          let yesProbBps: number | null = null;
          if (row.poolId) {
            try {
              const [sqrtPriceX96] = await baseRpcClient.readContract({
                address: MARKETS_PERIPHERY_ARC.stateView,
                abi: STATE_VIEW_ABI,
                functionName: "getSlot0",
                args: [row.poolId as `0x${string}`],
              });
              if (sqrtPriceX96 > 0n) {
                const yesIsToken0 =
                  row.yesToken.toLowerCase() < MARKETS_ARC.collateral.toLowerCase();
                yesProbBps = Math.round(
                  sqrtPriceX96ToProbability(sqrtPriceX96, yesIsToken0) * 10_000,
                );
              }
            } catch {
              // price unavailable — report the balance unmarked
            }
          }

          const winner = row.outcomeIndex === 0 ? row.homeTeam : row.awayTeam;
          const opponent = row.outcomeIndex === 0 ? row.awayTeam : row.homeTeam;
          const label = `${winner} to beat ${opponent}`;

          for (const [side, bal] of [
            ["yes", yesBal],
            ["no", noBal],
          ] as const) {
            if (bal === 0n) continue;
            const sideProb =
              yesProbBps === null ? null : side === "yes" ? yesProbBps : 10_000 - yesProbBps;
            positions.push({
              marketId: row.marketId,
              label,
              state: row.state,
              startsAt: Math.floor(new Date(row.startsAt).getTime() / 1000),
              side,
              balance: bal.toString(),
              impliedProbBps: sideProb,
              valueRaw: sideProb === null ? "0" : ((bal * BigInt(sideProb)) / 10_000n).toString(),
            });
          }
        }),
      );

      positions.sort((a, b) => b.startsAt - a.startsAt);
      res.json({ positions });
    } catch (err) {
      logger.warn({ err }, "market-positions: failed");
      res.status(500).json({ error: "Failed to load positions", code: "INTERNAL" });
    }
  },
);

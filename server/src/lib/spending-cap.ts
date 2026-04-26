import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { agentWallets } from "../db/schema/agent.ts";
import { dailyWalletSpend } from "../db/schema/safety.ts";
import { userPreferences } from "../db/schema/users.ts";
import { users } from "../db/schema/users.ts";
import { DEFAULT_DAILY_CAP_USD, HARD_DAILY_CAP_USD } from "./constants.ts";
import { SafetyError } from "./errors.ts";

function utcDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve the configured cap (USD) for a wallet address. Looks at the user's
 * primary wallet first, then agent wallets. Falls back to the default if no
 * record is found (treats it as an unknown wallet — we still cap it).
 */
export async function getDailyCap(address: string): Promise<number> {
  const lower = address.toLowerCase();
  const [user] = await db
    .select({ cap: userPreferences.dailyCapUsd })
    .from(users)
    .innerJoin(userPreferences, eq(userPreferences.userId, users.id))
    .where(eq(users.primaryAddress, lower))
    .limit(1);
  if (user) return Math.min(Number(user.cap), HARD_DAILY_CAP_USD);

  const [agent] = await db
    .select({ cap: agentWallets.dailyCapUsd })
    .from(agentWallets)
    .where(eq(agentWallets.address, lower))
    .limit(1);
  if (agent) return Math.min(Number(agent.cap), HARD_DAILY_CAP_USD);

  return DEFAULT_DAILY_CAP_USD;
}

/** Return today's accumulated spend (USD) for a wallet. */
export async function getDailySpend(
  address: string,
  spendDate: string = utcDate(),
): Promise<number> {
  const lower = address.toLowerCase();
  const [row] = await db
    .select({ spent: dailyWalletSpend.spentUsd })
    .from(dailyWalletSpend)
    .where(and(eq(dailyWalletSpend.walletAddress, lower), eq(dailyWalletSpend.spendDate, spendDate)))
    .limit(1);
  return row ? Number(row.spent) : 0;
}

/**
 * P1-001 — assert that `usdAmount` would not push the wallet over its
 * configured cap or the hard absolute ceiling. Read-only; does NOT increment
 * the ledger. Call `recordSpending` after the on-chain receipt confirms.
 */
export async function checkSpendingCap(address: string, usdAmount: number): Promise<void> {
  if (usdAmount < 0) throw new Error("checkSpendingCap: usdAmount must be non-negative");
  if (usdAmount > HARD_DAILY_CAP_USD) {
    throw new SafetyError(
      "spending_cap_hard_ceiling",
      `Single transaction $${usdAmount} exceeds the absolute ceiling of $${HARD_DAILY_CAP_USD}.`,
      { usdAmount, hardCeiling: HARD_DAILY_CAP_USD },
    );
  }
  const [cap, spent] = await Promise.all([getDailyCap(address), getDailySpend(address)]);
  if (spent + usdAmount > cap) {
    throw new SafetyError(
      "spending_cap_exceeded",
      `Daily cap $${cap} would be exceeded ($${spent} already spent today, +$${usdAmount}).`,
      { cap, spent, usdAmount },
    );
  }
}

/**
 * Increment today's ledger entry. Idempotent on (wallet, date) via UPSERT.
 * Caller should pass the actual settled USD value of the transaction.
 */
export async function recordSpending(address: string, usdAmount: number): Promise<void> {
  if (usdAmount < 0) throw new Error("recordSpending: usdAmount must be non-negative");
  const lower = address.toLowerCase();
  const today = utcDate();
  await db
    .insert(dailyWalletSpend)
    .values({ walletAddress: lower, spendDate: today, spentUsd: String(usdAmount), txCount: 1 })
    .onConflictDoUpdate({
      target: [dailyWalletSpend.walletAddress, dailyWalletSpend.spendDate],
      set: {
        spentUsd: sql`${dailyWalletSpend.spentUsd} + ${usdAmount}`,
        txCount: sql`${dailyWalletSpend.txCount} + 1`,
        updatedAt: sql`now()`,
      },
    });
}

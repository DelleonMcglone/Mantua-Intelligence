import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { agentWallets, type AgentWallet } from "../db/schema/agent.ts";
import { users } from "../db/schema/users.ts";
import { deriveAgentAccountName } from "./agent-wallet-name.ts";
import { getCdpClient } from "./cdp/client.ts";

export { deriveAgentAccountName };

export class UserNotFoundError extends Error {
  constructor(privyUserId: string) {
    super(
      `No user record found for Privy user ${privyUserId}. The user must connect their primary wallet (recordFirstSeen) before an agent wallet can be provisioned.`,
    );
    this.name = "UserNotFoundError";
  }
}

export class AgentWalletNotFoundError extends Error {
  constructor(privyUserId: string) {
    super(
      `No agent wallet provisioned for Privy user ${privyUserId}. Call POST /api/agent/wallet first.`,
    );
    this.name = "AgentWalletNotFoundError";
  }
}

/**
 * P6-003 — provision (or return) the user's single agent wallet.
 *
 * Order of operations:
 *   1. Resolve our internal user.id from privyUserId. Errors if absent.
 *   2. If an `agent_wallets` row already exists for this user, return it
 *      (cheap path; CDP is not contacted).
 *   3. Otherwise call `cdp.evm.getOrCreateAccount` — itself idempotent on
 *      the CDP side via the derived name — and persist the result with
 *      `onConflictDoNothing` on the unique `cdp_wallet_id` index. The
 *      onConflict path covers a concurrent-request race where two
 *      requests both passed step 2 simultaneously.
 *   4. If the insert returned nothing (race lost), re-read.
 *
 * This is one-wallet-per-user by design; the `agent_wallets` schema
 * doesn't enforce that uniqueness yet (it allows multiple wallets per
 * userId), but P6-003 only ever provisions one. Multi-wallet-per-user
 * is a v2.x conversation.
 */
export async function getOrCreateAgentWallet(privyUserId: string): Promise<AgentWallet> {
  // Indexing into the array (rather than destructuring) gives TS the
  // correct `T | undefined` narrowing — drizzle's destructured-element
  // type is otherwise too loose and the `if (!x)` guard becomes a
  // no-op under @typescript-eslint/no-unnecessary-condition.
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.privyUserId, privyUserId))
    .limit(1);
  const user = userRows.at(0);
  if (!user) throw new UserNotFoundError(privyUserId);

  const existingRows = await db
    .select()
    .from(agentWallets)
    .where(eq(agentWallets.userId, user.id))
    .limit(1);
  const existing = existingRows.at(0);
  if (existing) return existing;

  const name = deriveAgentAccountName(user.id);
  const account = await getCdpClient().evm.getOrCreateAccount({ name });

  const insertRows = await db
    .insert(agentWallets)
    .values({
      userId: user.id,
      cdpWalletId: name,
      address: account.address.toLowerCase(),
    })
    .onConflictDoNothing({ target: agentWallets.cdpWalletId })
    .returning();
  const row = insertRows.at(0);
  if (row) return row;

  const retryRows = await db
    .select()
    .from(agentWallets)
    .where(eq(agentWallets.userId, user.id))
    .limit(1);
  const retry = retryRows.at(0);
  if (!retry) {
    throw new Error("agent-wallet provision: row vanished after insert race");
  }
  return retry;
}

export async function getAgentWallet(privyUserId: string): Promise<AgentWallet | null> {
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.privyUserId, privyUserId))
    .limit(1);
  const user = userRows.at(0);
  if (!user) return null;
  const rows = await db
    .select()
    .from(agentWallets)
    .where(eq(agentWallets.userId, user.id))
    .limit(1);
  return rows.at(0) ?? null;
}

/**
 * P6-011 — set the agent wallet's daily USD spending cap.
 *
 * The spending-cap infrastructure in `server/src/lib/spending-cap.ts`
 * already keys on wallet address and falls through to `agent_wallets`
 * when the user-wallet lookup misses (see `getDailyCap`). What was
 * missing was a way to *configure* the cap per agent — agent wallets
 * were created with the schema default ($100) and there was no path to
 * change it. P6-011 adds that path.
 *
 * Cap range is enforced in the route layer (zod schema in
 * `server/src/routes/agent-wallets.ts`): non-negative number,
 * ≤ HARD_DAILY_CAP_USD ($50k). Values are stored as strings in the
 * `numeric(20,2)` column. Throws `UserNotFoundError` if the user has
 * no record yet, `AgentWalletNotFoundError` if no agent wallet is
 * provisioned for them.
 */
export async function updateAgentWalletCap(
  privyUserId: string,
  dailyCapUsd: number,
): Promise<AgentWallet> {
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.privyUserId, privyUserId))
    .limit(1);
  const user = userRows.at(0);
  if (!user) throw new UserNotFoundError(privyUserId);

  const updateRows = await db
    .update(agentWallets)
    .set({ dailyCapUsd: dailyCapUsd.toFixed(2), updatedAt: sql`now()` })
    .where(eq(agentWallets.userId, user.id))
    .returning();
  const wallet = updateRows.at(0);
  if (!wallet) throw new AgentWalletNotFoundError(privyUserId);
  return wallet;
}

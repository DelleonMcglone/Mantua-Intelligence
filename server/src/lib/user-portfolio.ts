import { desc, eq } from "drizzle-orm";
import { type Address, parseAbi } from "viem";
import { db } from "../db/client.ts";
import { portfolioTransactions, type PortfolioTransaction } from "../db/schema/trading.ts";
import { userPreferences, users } from "../db/schema/users.ts";
import { logger } from "./logger.ts";
import { baseRpcClient } from "./rpc-client.ts";
import { TOKENS, type TokenSymbol } from "./tokens.ts";
import { tokenAmountUsd } from "./usd-pricing.ts";

const ERC20_ABI = parseAbi(["function balanceOf(address account) view returns (uint256)"]);

export class UserNotFoundError extends Error {
  constructor(privyUserId: string) {
    super(`No user record for Privy user ${privyUserId}.`);
    this.name = "UserNotFoundError";
  }
}

export interface UserBalance {
  symbol: TokenSymbol;
  address: `0x${string}`;
  decimals: number;
  balanceRaw: string;
  usdValue: number;
}

export interface UserPortfolio {
  address: string;
  balances: UserBalance[];
  transactions: PortfolioTransaction[];
  preferences: {
    hideSmallBalances: boolean;
    dailyCapUsd: string;
    defaultSlippageBps: string;
  } | null;
}

/**
 * P8-003 / P8-005 — user wallet portfolio: balances + tx history +
 * preferences. Mirrors `agent-portfolio.ts:getAgentPortfolio` but
 * keyed off the Privy wallet address from auth, and adds the user's
 * stored preferences (so the client can read `hide_small_balances`
 * without a second round-trip).
 */
export async function getUserPortfolio(
  privyUserId: string,
  walletAddress: string,
  txLimit = 50,
): Promise<UserPortfolio> {
  const lower = walletAddress.toLowerCase();
  const tokens = Object.entries(TOKENS) as [TokenSymbol, (typeof TOKENS)[TokenSymbol]][];

  const balances = await Promise.all(
    tokens.map(async ([symbol, t]) => {
      try {
        const raw = t.native
          ? await baseRpcClient.getBalance({ address: lower as Address })
          : await baseRpcClient.readContract({
              address: t.address,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [lower as Address],
            });
        const usdValue = await tokenAmountUsd(symbol, raw);
        return {
          symbol,
          address: t.address,
          decimals: t.decimals,
          balanceRaw: raw.toString(),
          usdValue,
        };
      } catch (err) {
        logger.warn({ err, symbol, address: t.address }, "balance fetch failed; treating as 0");
        return {
          symbol,
          address: t.address,
          decimals: t.decimals,
          balanceRaw: "0",
          usdValue: 0,
        };
      }
    }),
  );

  // DB lookups (tx history + prefs) degrade to empty/null if Postgres is
  // unreachable — balances come from RPC and shouldn't be hidden behind
  // an offline database.
  let transactions: PortfolioTransaction[] = [];
  let preferences: UserPortfolio["preferences"] = null;
  try {
    transactions = await db
      .select()
      .from(portfolioTransactions)
      .where(eq(portfolioTransactions.walletAddress, lower))
      .orderBy(desc(portfolioTransactions.createdAt))
      .limit(txLimit);

    const userRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.privyUserId, privyUserId))
      .limit(1);
    const user = userRows.at(0);

    if (user) {
      const prefRows = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, user.id))
        .limit(1);
      const pref = prefRows.at(0);
      if (pref) {
        // hide_small_balances is stored as jsonb (boolean); coerce safely.
        const hide = typeof pref.hideSmallBalances === "boolean" ? pref.hideSmallBalances : true;
        preferences = {
          hideSmallBalances: hide,
          dailyCapUsd: pref.dailyCapUsd,
          defaultSlippageBps: pref.defaultSlippageBps,
        };
      }
    }
  } catch (err) {
    logger.warn({ err }, "portfolio DB lookups failed; returning balances only");
  }

  return {
    address: lower,
    balances,
    transactions,
    preferences,
  };
}

import { desc, eq } from "drizzle-orm";
import { type Address, parseAbi } from "viem";
import { db } from "../db/client.ts";
import { portfolioTransactions, type PortfolioTransaction } from "../db/schema/trading.ts";
import { AgentWalletNotFoundError, getAgentWallet } from "./agent-wallet.ts";
import { baseRpcClient } from "./rpc-client.ts";
import { TOKENS, type TokenSymbol } from "./tokens.ts";
import { tokenAmountUsd } from "./usd-pricing.ts";

const ERC20_ABI = parseAbi(["function balanceOf(address account) view returns (uint256)"]);

export interface AgentBalance {
  symbol: TokenSymbol;
  address: `0x${string}`;
  decimals: number;
  balanceRaw: string;
  usdValue: number;
}

export interface AgentPortfolio {
  address: string;
  balances: AgentBalance[];
  transactions: PortfolioTransaction[];
}

/**
 * P6-008 — agent wallet balances + recent tx history.
 *
 * Balances are read live from the chain via baseRpcClient; native ETH
 * via getBalance, ERC-20s via balanceOf. USD values come from the
 * existing tokenAmountUsd helper (CoinGecko, 60s cached). All four
 * supported tokens are always returned, even at zero balance, so the UI
 * can render a stable list.
 *
 * Transactions are pulled from `portfolio_transactions` filtered to the
 * agent address — the same table the user-side records into, so user
 * and agent histories sit in one ledger.
 */
export async function getAgentPortfolio(
  privyUserId: string,
  txLimit = 50,
): Promise<AgentPortfolio> {
  const wallet = await getAgentWallet(privyUserId);
  if (!wallet) throw new AgentWalletNotFoundError(privyUserId);

  const agentAddress = wallet.address as Address;
  const tokens = Object.entries(TOKENS) as [TokenSymbol, (typeof TOKENS)[TokenSymbol]][];

  const balances = await Promise.all(
    tokens.map(async ([symbol, t]) => {
      const raw = t.native
        ? await baseRpcClient.getBalance({ address: agentAddress })
        : await baseRpcClient.readContract({
            address: t.address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [agentAddress],
          });
      const usdValue = await tokenAmountUsd(symbol, raw);
      return {
        symbol,
        address: t.address,
        decimals: t.decimals,
        balanceRaw: raw.toString(),
        usdValue,
      };
    }),
  );

  const transactions = await db
    .select()
    .from(portfolioTransactions)
    .where(eq(portfolioTransactions.walletAddress, wallet.address))
    .orderBy(desc(portfolioTransactions.createdAt))
    .limit(txLimit);

  return {
    address: wallet.address,
    balances,
    transactions,
  };
}

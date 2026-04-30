import { eq } from "drizzle-orm";
import { type Address, type Hex, parseUnits } from "viem";
import { db } from "../db/client.ts";
import { portfolioTransactions } from "../db/schema/trading.ts";
import { users } from "../db/schema/users.ts";
import { explorerTxUrl } from "./agent-send.ts";
import { AgentWalletNotFoundError, getAgentWallet } from "./agent-wallet.ts";
import { getCdpClient } from "./cdp/client.ts";
import { BASE_CHAIN_ID, IS_MAINNET } from "./constants.ts";
import { checkSpendingCap, recordSpending } from "./spending-cap.ts";
import { getToken, type TokenSymbol, ZERO_ADDRESS } from "./tokens.ts";
import { fetchQuote, fetchSwapTx } from "./uniswap.ts";
import { tokenAmountUsd } from "./usd-pricing.ts";

/**
 * P6-005 — execute a Uniswap swap from the agent wallet.
 *
 * Reuses the Phase 3 primitives in `uniswap.ts` (`fetchQuote`,
 * `fetchSwapTx`) but does the whole orchestration server-side rather
 * than splitting it across client round-trips like the user path:
 *
 *   1. Look up the agent wallet.
 *   2. Cap-check the input USD value (Phase 1 / P6-011 rail).
 *   3. Quote the trade with `swapper = agentAddress`.
 *   4. If the quote includes a Permit2 permit (`PermitSingle`), have
 *      the CDP server account sign it via `signTypedData` (the same
 *      shape Phase 3's client signs, just routed through CDP).
 *   5. Get the swap calldata.
 *   6. Send the tx via the network-scoped CDP account.
 *   7. Record spending + portfolio_transactions, mirroring what
 *      `/api/swap/record` does for the user path.
 *
 * Single API call from the client perspective; the server walks the
 * Trading API + signing internally because the agent has no human in
 * the loop.
 */
const CDP_NETWORK: "base" | "base-sepolia" = IS_MAINNET ? "base" : "base-sepolia";

export interface AgentSwapArgs {
  privyUserId: string;
  tokenIn: TokenSymbol;
  tokenOut: TokenSymbol;
  /** Decimal-string amount in the human-readable units of `tokenIn`. */
  amountIn: string;
  /** Optional fractional-percent slippage (e.g. 0.5 for 0.5%). */
  slippageTolerance?: number;
}

export interface AgentSwapResult {
  txHash: `0x${string}`;
  explorerUrl: string;
  agentAddress: string;
  tokenIn: TokenSymbol;
  tokenOut: TokenSymbol;
  amountInRaw: string;
  amountOutRaw: string;
  usdValue: number;
  network: typeof CDP_NETWORK;
}

/**
 * For the Trading API's `tokenIn`/`tokenOut`, native ETH uses the zero
 * address (consistent with Uniswap's convention). All other tokens use
 * their canonical contract address.
 */
function tokenForApi(symbol: TokenSymbol): Address {
  const t = getToken(symbol);
  return t.native ? ZERO_ADDRESS : t.address;
}

export async function swapFromAgentWallet(args: AgentSwapArgs): Promise<AgentSwapResult> {
  const { privyUserId, tokenIn, tokenOut, amountIn, slippageTolerance } = args;
  if (tokenIn === tokenOut) throw new Error("tokenIn and tokenOut must differ");

  const wallet = await getAgentWallet(privyUserId);
  if (!wallet) throw new AgentWalletNotFoundError(privyUserId);

  const inDef = getToken(tokenIn);
  const amountAtomic = parseUnits(amountIn, inDef.decimals);
  if (amountAtomic <= 0n) throw new Error("amountIn must be positive");

  const usdValue = await tokenAmountUsd(tokenIn, amountAtomic);
  await checkSpendingCap(wallet.address, usdValue);

  const quote = await fetchQuote({
    chainId: BASE_CHAIN_ID,
    tokenIn: tokenForApi(tokenIn),
    tokenOut: tokenForApi(tokenOut),
    amount: amountAtomic.toString(),
    type: "EXACT_INPUT",
    swapper: wallet.address,
    ...(slippageTolerance !== undefined ? { slippageTolerance } : {}),
  });

  const cdp = getCdpClient();
  const account = await cdp.evm.getAccount({ name: wallet.cdpWalletId });

  let signature: string | undefined;
  if (quote.permitData) {
    const pd = quote.permitData;
    // Same primaryType the client uses (`PermitSingle`); the Trading
    // API only emits Permit2 single-token permits in this flow.
    const sig = await account.signTypedData({
      domain: pd.domain as Parameters<typeof account.signTypedData>[0]["domain"],
      types: pd.types as Parameters<typeof account.signTypedData>[0]["types"],
      primaryType: "PermitSingle",
      message: pd.values as Record<string, unknown>,
    });
    signature = sig;
  }

  const swap = await fetchSwapTx(quote, signature);

  const networked = await account.useNetwork(CDP_NETWORK);
  const tx = await networked.sendTransaction({
    transaction: {
      to: swap.to as Address,
      data: swap.data as Hex,
      value: BigInt(swap.value || "0"),
    },
  });

  // Record spending + portfolio transaction. Mirrors POST /api/swap/record
  // for the user path so dashboards / cap math stay consistent across both
  // wallet kinds.
  await recordSpending(wallet.address, usdValue);

  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.privyUserId, privyUserId))
    .limit(1);
  const user = userRows.at(0);
  if (user) {
    await db.insert(portfolioTransactions).values({
      userId: user.id,
      walletAddress: wallet.address,
      action: "swap",
      txHash: tx.transactionHash,
      chainId: BASE_CHAIN_ID,
      params: {
        tokenIn,
        tokenOut,
        amountInRaw: amountAtomic.toString(),
        amountOutRaw: quote.quote.output.amount,
        agent: true,
      },
      outcome: "success",
      usdValue: usdValue > 0 ? usdValue.toFixed(2) : null,
    });
  }

  return {
    txHash: tx.transactionHash,
    explorerUrl: explorerTxUrl(tx.transactionHash),
    agentAddress: wallet.address,
    tokenIn,
    tokenOut,
    amountInRaw: amountAtomic.toString(),
    amountOutRaw: quote.quote.output.amount,
    usdValue,
    network: CDP_NETWORK,
  };
}

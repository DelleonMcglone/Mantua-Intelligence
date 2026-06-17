import { eq } from "drizzle-orm";
import { parseUnits } from "viem";
import { db } from "../db/client.ts";
import { portfolioTransactions } from "../db/schema/trading.ts";
import { users } from "../db/schema/users.ts";
import { explorerTxUrl } from "./agent-send.ts";
import { AgentWalletNotFoundError, getAgentWallet } from "./agent-wallet.ts";
import { executeAgentAbiCall, executeAgentCalldata } from "./circle/execute.ts";
import { ACTIVE_CHAIN_ID } from "./constants.ts";
import { checkSpendingCap, recordSpending } from "./spending-cap.ts";
import { getToken, type TokenSymbol } from "./tokens.ts";
import { tokenAmountUsd } from "./usd-pricing.ts";
import { buildPoolSwapTestCalldata, quoteExactInputV4 } from "./v4-onchain-swap.ts";
import type { FeeTier } from "./v4-contracts.ts";

/**
 * Execute a swap from the agent wallet on Arc Testnet via its Circle
 * Developer-Controlled Wallet.
 *
 * Agent swaps run against the no-hook pool for the pair (the Stable Protection
 * hook's circuit breaker blocks USDC/EURC, so no-hook is the reliable agent
 * path). The on-chain v4 quote auto-resolves whichever fee tier the pool was
 * actually created at. Two gas-sponsored Circle txs: approve the input ERC-20
 * to the swap router, then execute the swap calldata.
 */
const AGENT_NETWORK = "arc-testnet" as const;

// No-hook pools: the quoter auto-resolves to the tier the pool was created at,
// so this is just the starting probe.
const DEFAULT_PROBE_FEE: FeeTier = 3000;

export interface AgentSwapArgs {
  privyUserId: string;
  tokenIn: TokenSymbol;
  tokenOut: TokenSymbol;
  /** Decimal-string amount in the human-readable units of `tokenIn`. */
  amountIn: string;
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
  network: typeof AGENT_NETWORK;
}

export async function swapFromAgentWallet(args: AgentSwapArgs): Promise<AgentSwapResult> {
  const { privyUserId, tokenIn, tokenOut, amountIn } = args;
  if (tokenIn === tokenOut) throw new Error("tokenIn and tokenOut must differ");

  const wallet = await getAgentWallet(privyUserId);
  if (!wallet) throw new AgentWalletNotFoundError(privyUserId);

  const inDef = getToken(tokenIn);
  const amountAtomic = parseUnits(amountIn, inDef.decimals);
  if (amountAtomic <= 0n) throw new Error("amountIn must be positive");

  const usdValue = await tokenAmountUsd(tokenIn, amountAtomic);
  await checkSpendingCap(wallet.address, usdValue);

  // Quote on Arc (no hook); the tier is auto-resolved to the live pool.
  // chainId omitted — both builders default to Arc (the only supported chain).
  const quote = await quoteExactInputV4({
    tokenIn,
    tokenOut,
    fee: DEFAULT_PROBE_FEE,
    hook: null,
    amountInRaw: amountAtomic,
  });
  const swap = buildPoolSwapTestCalldata({
    poolKey: quote.poolKey,
    zeroForOne: quote.zeroForOne,
    amountInRaw: amountAtomic,
  });

  // Approve the input ERC-20 to the swap router, then execute the swap. Native
  // input has no approvalTarget (value is carried on the call instead).
  if (swap.approvalTarget && !inDef.native) {
    await executeAgentAbiCall({
      walletId: wallet.circleWalletId,
      to: inDef.address,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [swap.approvalTarget, amountAtomic.toString()],
    });
  }

  const { txHash } = await executeAgentCalldata({
    walletId: wallet.circleWalletId,
    to: swap.to,
    callData: swap.data,
    ...(swap.value !== "0" ? { value: swap.value } : {}),
  });

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
      txHash,
      chainId: ACTIVE_CHAIN_ID,
      params: {
        tokenIn,
        tokenOut,
        amountInRaw: amountAtomic.toString(),
        amountOutRaw: quote.amountOut,
        agent: true,
      },
      outcome: "success",
      usdValue: usdValue > 0 ? usdValue.toFixed(2) : null,
    });
  }

  return {
    txHash,
    explorerUrl: explorerTxUrl(txHash),
    agentAddress: wallet.address,
    tokenIn,
    tokenOut,
    amountInRaw: amountAtomic.toString(),
    amountOutRaw: quote.amountOut,
    usdValue,
    network: AGENT_NETWORK,
  };
}

import { type Address, parseUnits } from "viem";
import { AgentWalletNotFoundError, getAgentWallet } from "./agent-wallet.ts";
import { getCdpClient } from "./cdp/client.ts";
import { IS_MAINNET } from "./constants.ts";
import { checkSpendingCap, recordSpending } from "./spending-cap.ts";
import { getToken, type TokenSymbol } from "./tokens.ts";
import { tokenAmountUsd } from "./usd-pricing.ts";

/**
 * P6-004 — send tokens from the agent wallet.
 *
 * Network is fixed to Base (mainnet or sepolia per MANTUA_NETWORK). The
 * CDP server-managed account signs; the user has no signing role here
 * (per D-008 the user's Privy wallet is never touched by the agent
 * path). Spending cap is enforced via the existing Phase 1 rail in
 * spending-cap.ts, which already keys on wallet address and treats
 * agent wallets transparently (P6-011 added the cap-config endpoint).
 */
const CDP_NETWORK: "base" | "base-sepolia" = IS_MAINNET ? "base" : "base-sepolia";

export interface AgentSendArgs {
  privyUserId: string;
  to: Address;
  symbol: TokenSymbol;
  /** Decimal-string amount in human-readable units, e.g. "1.5" for 1.5 ETH. */
  amount: string;
}

export interface AgentSendResult {
  txHash: `0x${string}`;
  amountAtomic: string;
  amountDecimal: string;
  symbol: TokenSymbol;
  to: Address;
  agentAddress: string;
  usdValue: number;
  network: typeof CDP_NETWORK;
  explorerUrl: string;
}

export function explorerTxUrl(txHash: string): string {
  return IS_MAINNET
    ? `https://basescan.org/tx/${txHash}`
    : `https://sepolia.basescan.org/tx/${txHash}`;
}

export async function sendFromAgentWallet(args: AgentSendArgs): Promise<AgentSendResult> {
  const { privyUserId, to, symbol, amount } = args;

  const wallet = await getAgentWallet(privyUserId);
  if (!wallet) throw new AgentWalletNotFoundError(privyUserId);

  const token = getToken(symbol);
  const amountAtomic = parseUnits(amount, token.decimals);
  if (amountAtomic <= 0n) {
    throw new Error("amount must be positive");
  }

  // USD value for the cap rail. tokenAmountUsd returns 0 if pricing is
  // unavailable; the cap rail is a no-op on testnet anyway, so a 0 value
  // there is fine. On mainnet, a price of 0 means we couldn't reach
  // CoinGecko — checkSpendingCap will treat that as a $0 spend, which is
  // the same fail-open behavior the existing user paths use.
  const usdValue = await tokenAmountUsd(symbol, amountAtomic);
  await checkSpendingCap(wallet.address, usdValue);

  const cdp = getCdpClient();
  const account = await cdp.evm.getAccount({ name: wallet.cdpWalletId });
  const networked = await account.useNetwork(CDP_NETWORK);

  // CDP TransferOptions accepts the literal "eth" for the native asset
  // or a hex contract address for any ERC-20. We always pass the address
  // for ERC-20s rather than the SDK's "usdc" shortcut so the network's
  // canonical address (different on mainnet vs sepolia) is explicit.
  const tokenSpec: "eth" | `0x${string}` = token.native ? "eth" : token.address;
  const result = await networked.transfer({
    to,
    amount: amountAtomic,
    token: tokenSpec,
  });

  await recordSpending(wallet.address, usdValue);

  return {
    txHash: result.transactionHash,
    amountAtomic: amountAtomic.toString(),
    amountDecimal: amount,
    symbol,
    to,
    agentAddress: wallet.address,
    usdValue,
    network: CDP_NETWORK,
    explorerUrl: explorerTxUrl(result.transactionHash),
  };
}

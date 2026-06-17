/**
 * Arc wallet for the agent — a plain viem wallet implementing the `AgentWallet`
 * surface the action providers use. Built from the agent's private key; gas is
 * paid in Arc's native USDC. (No Coinbase AgentKit / ViemWalletProvider — the
 * action-kit owns the interface now, which also removes the cross-viem-copy
 * cast the AgentKit wrapper needed.)
 */
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createArcChain } from "../config/arc-chain.ts";
import type { AgentEnv } from "../config/env.ts";
import type { AgentWallet } from "./action-kit.ts";

export function createArcWallet(env: AgentEnv): AgentWallet {
  const account = privateKeyToAccount(env.AGENT_PRIVATE_KEY as `0x${string}`);
  const chain = createArcChain(env.ARC_RPC_URL);
  const transport = http(env.ARC_RPC_URL);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  return {
    getAddress: () => account.address,
    readContract: publicClient.readContract,
    getBalance: () => publicClient.getBalance({ address: account.address }),
    sendTransaction: (tx) =>
      walletClient.sendTransaction({
        account,
        chain,
        to: tx.to,
        data: tx.data,
        ...(tx.value !== undefined ? { value: tx.value } : {}),
      }),
    waitForTransactionReceipt: (hash) => publicClient.waitForTransactionReceipt({ hash }),
  };
}

/**
 * Builds the AgentKit ViemWalletProvider for Arc testnet from the agent's
 * private key. Uses ViemWalletProvider (not CdpWalletProvider) because Arc
 * is not a CDP-supported network. Gas is paid in Arc's native USDC.
 */
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ViemWalletProvider } from "@coinbase/agentkit";
import { createArcChain } from "../config/arc-chain.ts";
import type { AgentEnv } from "../config/env.ts";

export function createArcWalletProvider(env: AgentEnv): ViemWalletProvider {
  const account = privateKeyToAccount(env.AGENT_PRIVATE_KEY as `0x${string}`);
  const chain = createArcChain(env.ARC_RPC_URL);
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(env.ARC_RPC_URL),
  });
  // AgentKit and this workspace each resolve their own (byte-identical)
  // viem 2.38.3 copy because the monorepo root holds viem 2.48.4, so the
  // WalletClient types are nominally distinct across copies. The runtime
  // object is the same shape; cast at this single boundary.
  type ViemWalletProviderArg = ConstructorParameters<typeof ViemWalletProvider>[0];
  return new ViemWalletProvider(walletClient as unknown as ViemWalletProviderArg);
}

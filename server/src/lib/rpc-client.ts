import { createPublicClient, http, type PublicClient } from "viem";
import { arcTestnet, base, baseSepolia } from "viem/chains";
import { ARC_TESTNET_CHAIN_ID, type SupportedTestnetChainId } from "./chains.ts";
import { IS_MAINNET } from "./constants.ts";
import { env } from "../env.ts";

const baseClient: PublicClient = createPublicClient({
  chain: IS_MAINNET ? base : baseSepolia,
  transport: http(env.BASE_RPC_URL),
});

const arcClient: PublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(env.ARC_RPC_URL),
});

/**
 * Legacy single-chain export. Prefer `getRpcClient(chainId)`. Kept for legacy single-chain
 * code paths that still implicitly assume Base.
 */
export const baseRpcClient = baseClient;

export function getRpcClient(chainId: SupportedTestnetChainId): PublicClient {
  if (!IS_MAINNET && chainId === ARC_TESTNET_CHAIN_ID) return arcClient;
  return baseClient;
}

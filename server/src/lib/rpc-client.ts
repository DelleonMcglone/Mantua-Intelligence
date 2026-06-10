import { createPublicClient, http } from "viem";
import { arcTestnet, base, baseSepolia } from "viem/chains";
import { ARC_TESTNET_CHAIN_ID, type SupportedTestnetChainId } from "./chains.ts";
import { IS_MAINNET } from "./constants.ts";
import { env } from "../env.ts";

// Types are inferred (not annotated `: PublicClient`): viem's generic
// PublicClient default params don't unify with createPublicClient's
// chain-specialized return, which TS reports as a spurious duplicate-type
// conflict. The inferred type is a PublicClient and works for all callers.
const baseClient = createPublicClient({
  chain: IS_MAINNET ? base : baseSepolia,
  transport: http(env.BASE_RPC_URL),
});

const arcClient = createPublicClient({
  chain: arcTestnet,
  transport: http(env.ARC_RPC_URL),
});

/**
 * Legacy single-chain export. Prefer `getRpcClient(chainId)`. Kept for legacy single-chain
 * code paths that still implicitly assume Base.
 */
export const baseRpcClient = baseClient;

export function getRpcClient(chainId: SupportedTestnetChainId) {
  if (!IS_MAINNET && chainId === ARC_TESTNET_CHAIN_ID) return arcClient;
  return baseClient;
}

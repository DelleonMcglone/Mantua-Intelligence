import { createPublicClient, http, type PublicClient } from "viem";
import { base, baseSepolia } from "viem/chains";
import { type SupportedTestnetChainId } from "./chains.ts";
import { IS_MAINNET } from "./constants.ts";
import { env } from "../env.ts";

const baseClient: PublicClient = createPublicClient({
  chain: IS_MAINNET ? base : baseSepolia,
  transport: http(env.BASE_RPC_URL),
});

/**
 * Legacy single-chain export. Prefer `getRpcClient(chainId)`. Kept for legacy single-chain
 * code paths that still implicitly assume Base.
 */
export const baseRpcClient = baseClient;

export function getRpcClient(chainId: SupportedTestnetChainId): PublicClient {
  void chainId;
  return baseClient;
}

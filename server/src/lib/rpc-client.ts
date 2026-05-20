import { createPublicClient, http, type PublicClient } from "viem";
import { base, baseSepolia, type Chain } from "viem/chains";
import {
  BASE_SEPOLIA_CHAIN_ID,
  UNICHAIN_SEPOLIA_CHAIN_ID,
  type SupportedTestnetChainId,
} from "./chains.ts";
import { IS_MAINNET } from "./constants.ts";
import { env } from "../env.ts";

const unichainSepolia: Chain = {
  id: UNICHAIN_SEPOLIA_CHAIN_ID,
  name: "Unichain Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.unichain.org"] } },
  blockExplorers: {
    default: { name: "Uniscan", url: "https://sepolia.uniscan.xyz" },
  },
  testnet: true,
};

const baseClient: PublicClient = createPublicClient({
  chain: IS_MAINNET ? base : baseSepolia,
  transport: http(env.BASE_RPC_URL),
});

const unichainClient: PublicClient = createPublicClient({
  chain: unichainSepolia,
  transport: http(env.UNICHAIN_SEPOLIA_RPC_URL),
});

/**
 * Legacy single-chain export. Prefer `getRpcClient(chainId)`. Kept for legacy single-chain
 * code paths that still implicitly assume Base.
 */
export const baseRpcClient = baseClient;

export function getRpcClient(chainId: SupportedTestnetChainId): PublicClient {
  if (chainId === BASE_SEPOLIA_CHAIN_ID) return baseClient;
  return unichainClient;
}

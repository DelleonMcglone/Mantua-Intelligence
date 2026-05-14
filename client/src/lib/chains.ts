/**
 * Supported chains, runtime multi-chain support.
 *
 * MVP scope (PR #101): Base Sepolia (84532) + Unichain Sepolia (1301).
 * The compile-time `IS_MAINNET` flag from `tokens.ts` is preserved for
 * the eventual mainnet launch but mainnet is single-chain (Base
 * Mainnet) and out of scope for this beta.
 *
 * Per-chain config (v4 contracts, hook addresses, token registry,
 * RPC URL) is keyed by chainId in the modules that own each concern.
 */

import { baseSepolia, type Chain } from "viem/chains";

export const BASE_MAINNET_CHAIN_ID = 8453 as const;
export const BASE_SEPOLIA_CHAIN_ID = 84532 as const;
export const UNICHAIN_SEPOLIA_CHAIN_ID = 1301 as const;

export const SUPPORTED_TESTNET_CHAIN_IDS = [
  BASE_SEPOLIA_CHAIN_ID,
  UNICHAIN_SEPOLIA_CHAIN_ID,
] as const;

export type SupportedTestnetChainId = (typeof SUPPORTED_TESTNET_CHAIN_IDS)[number];

export function isSupportedTestnetChainId(id: number): id is SupportedTestnetChainId {
  return (SUPPORTED_TESTNET_CHAIN_IDS as readonly number[]).includes(id);
}

/**
 * viem `Chain` definition for Unichain Sepolia. The runtime viem version
 * we depend on may not export `unichainSepolia` yet (it was added in
 * 2.21+); inlining keeps us insulated from version drift.
 */
export const unichainSepolia: Chain = {
  id: UNICHAIN_SEPOLIA_CHAIN_ID,
  name: "Unichain Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://sepolia.unichain.org"] },
  },
  blockExplorers: {
    default: { name: "Uniscan", url: "https://sepolia.uniscan.xyz" },
  },
  testnet: true,
};

export interface ChainInfo {
  id: SupportedTestnetChainId;
  shortName: string;
  displayName: string;
  viemChain: Chain;
  /** Public RPC URL. Override per env via `VITE_<CHAIN>_RPC_URL`. */
  defaultRpcUrl: string;
  /** `<base>/tx/<hash>` for transaction links; `<base>/address/<addr>` for addresses. */
  explorerUrl: string;
  explorerName: string;
  /** Brand-color dot for the chain selector chip. */
  dotColor: string;
}

export const CHAIN_INFO: Record<SupportedTestnetChainId, ChainInfo> = {
  [BASE_SEPOLIA_CHAIN_ID]: {
    id: BASE_SEPOLIA_CHAIN_ID,
    shortName: "Base",
    displayName: "Base Sepolia",
    viemChain: baseSepolia,
    defaultRpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
    explorerName: "BaseScan",
    dotColor: "#0052ff",
  },
  [UNICHAIN_SEPOLIA_CHAIN_ID]: {
    id: UNICHAIN_SEPOLIA_CHAIN_ID,
    shortName: "Unichain",
    displayName: "Unichain Sepolia",
    viemChain: unichainSepolia,
    defaultRpcUrl: "https://sepolia.unichain.org",
    explorerUrl: "https://sepolia.uniscan.xyz",
    explorerName: "Uniscan",
    dotColor: "#f50db4",
  },
};

export function getChainInfo(chainId: SupportedTestnetChainId): ChainInfo {
  return CHAIN_INFO[chainId];
}

export function getExplorerTxUrl(chainId: SupportedTestnetChainId, txHash: string): string {
  return `${CHAIN_INFO[chainId].explorerUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(
  chainId: SupportedTestnetChainId,
  address: string,
): string {
  return `${CHAIN_INFO[chainId].explorerUrl}/address/${address}`;
}

/**
 * Resolve the RPC URL for a chain. Falls back to the public endpoint;
 * each chain can be overridden by setting `VITE_BASE_RPC_URL` or
 * `VITE_UNICHAIN_RPC_URL` in `client/.env.local`.
 */
export function getRpcUrl(chainId: SupportedTestnetChainId): string {
  if (chainId === BASE_SEPOLIA_CHAIN_ID) {
    return (
      (import.meta.env.VITE_BASE_RPC_URL as string | undefined) ??
      CHAIN_INFO[BASE_SEPOLIA_CHAIN_ID].defaultRpcUrl
    );
  }
  return (
    (import.meta.env.VITE_UNICHAIN_RPC_URL as string | undefined) ??
    CHAIN_INFO[UNICHAIN_SEPOLIA_CHAIN_ID].defaultRpcUrl
  );
}

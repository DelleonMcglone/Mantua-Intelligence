/**
 * Supported chains.
 *
 * Scope: Base Sepolia (84532) only. The compile-time `IS_MAINNET` flag
 * from `tokens.ts` is preserved for the eventual mainnet launch but
 * mainnet is single-chain (Base Mainnet) and out of scope for this beta.
 *
 * Per-chain config (v4 contracts, hook addresses, token registry,
 * RPC URL) is keyed by chainId in the modules that own each concern.
 */

import { arcTestnet, baseSepolia, type Chain } from "viem/chains";

export const BASE_MAINNET_CHAIN_ID = 8453 as const;
export const BASE_SEPOLIA_CHAIN_ID = 84532 as const;
export const ARC_TESTNET_CHAIN_ID = 5042002 as const;

/**
 * Arc Testnet — Circle's public testnet (chain id 5042002), where USDC
 * is the native gas token: native gas uses 18 decimals, while the USDC
 * ERC-20 (0x3600…0000 in `tokens.ts`) uses 6. viem ships this chain
 * natively, so we re-export it for the Privy config + per-chain RPC.
 */
export { arcTestnet };

export const SUPPORTED_TESTNET_CHAIN_IDS = [
  BASE_SEPOLIA_CHAIN_ID,
  ARC_TESTNET_CHAIN_ID,
] as const;

export type SupportedTestnetChainId = (typeof SUPPORTED_TESTNET_CHAIN_IDS)[number];

export function isSupportedTestnetChainId(id: number): id is SupportedTestnetChainId {
  return (SUPPORTED_TESTNET_CHAIN_IDS as readonly number[]).includes(id);
}

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
  [ARC_TESTNET_CHAIN_ID]: {
    id: ARC_TESTNET_CHAIN_ID,
    shortName: "Arc",
    displayName: "Arc Testnet",
    viemChain: arcTestnet,
    defaultRpcUrl: "https://rpc.testnet.arc.network",
    explorerUrl: "https://testnet.arcscan.app",
    explorerName: "ArcScan",
    dotColor: "#4a6fa5",
  },
};

export function getChainInfo(chainId: SupportedTestnetChainId): ChainInfo {
  return CHAIN_INFO[chainId];
}

/**
 * Network options for the chatbot's network switcher. This is a
 * presentation-layer list, intentionally decoupled from the typed
 * `SupportedTestnetChainId` data registry so it can surface networks
 * that aren't yet wired for on-chain reads/writes (UI stubs).
 */
export type NetworkKey = "base" | "arc";

export interface NetworkOption {
  key: NetworkKey;
  shortName: string;
  displayName: string;
  /** Brand-color dot for the selector chip. */
  dotColor: string;
  /**
   * The real data chain backing this option, or `null` for a UI-only
   * stub. Selecting a stub updates the switcher label but does NOT
   * switch the wallet or change which chain balances/pools are read
   * from — those fall back to the default Base data chain. Replace Arc's
   * `null` with a real `SupportedTestnetChainId` once its network params
   * (chainId, RPC, explorer, token registry) are wired in.
   */
  dataChainId: SupportedTestnetChainId | null;
}

export const NETWORK_OPTIONS: NetworkOption[] = [
  {
    key: "base",
    shortName: CHAIN_INFO[BASE_SEPOLIA_CHAIN_ID].shortName,
    displayName: CHAIN_INFO[BASE_SEPOLIA_CHAIN_ID].displayName,
    dotColor: CHAIN_INFO[BASE_SEPOLIA_CHAIN_ID].dotColor,
    dataChainId: BASE_SEPOLIA_CHAIN_ID,
  },
  {
    key: "arc",
    shortName: CHAIN_INFO[ARC_TESTNET_CHAIN_ID].shortName,
    displayName: CHAIN_INFO[ARC_TESTNET_CHAIN_ID].displayName,
    dotColor: CHAIN_INFO[ARC_TESTNET_CHAIN_ID].dotColor,
    dataChainId: ARC_TESTNET_CHAIN_ID,
  },
];

export const DEFAULT_NETWORK_KEY: NetworkKey = "base";

export function isNetworkKey(s: string): s is NetworkKey {
  return s === "base" || s === "arc";
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
 * overridable by setting `VITE_BASE_RPC_URL` in `client/.env.local`.
 */
export function getRpcUrl(chainId: SupportedTestnetChainId): string {
  if (chainId === ARC_TESTNET_CHAIN_ID) {
    return (
      (import.meta.env.VITE_ARC_RPC_URL as string | undefined) ??
      CHAIN_INFO[ARC_TESTNET_CHAIN_ID].defaultRpcUrl
    );
  }
  return (
    (import.meta.env.VITE_BASE_RPC_URL as string | undefined) ??
    CHAIN_INFO[BASE_SEPOLIA_CHAIN_ID].defaultRpcUrl
  );
}

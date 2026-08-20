/**
 * Supported chains: **Base Sepolia (84532, default)** and **Arc Testnet
 * (5042002)**. Per-chain config (v4 contracts, hook addresses, token
 * registry) is keyed by chainId in the modules that own each concern —
 * see `v4-contracts.ts`, `tokens.ts`, `hook-pair-gating.ts`.
 */

export const ARC_TESTNET_CHAIN_ID = 5042002 as const;
export const BASE_SEPOLIA_CHAIN_ID = 84532 as const;

/** Chains that can carry a user-initiated transaction. Default first. */
export const SUPPORTED_TESTNET_CHAIN_IDS = [BASE_SEPOLIA_CHAIN_ID, ARC_TESTNET_CHAIN_ID] as const;

export type SupportedTestnetChainId = (typeof SUPPORTED_TESTNET_CHAIN_IDS)[number];

/**
 * Default chain when a request omits chainId. Deliberately **Arc**, not
 * the client's Base-first default: every internal flow that omits chainId
 * (agent execution, crons, peg-sync, hook reads) predates multi-chain and
 * means Arc; the client always sends an explicit chainId. Flows going
 * chain-aware must pass chainId explicitly rather than lean on this.
 */
export const DEFAULT_CHAIN_ID: SupportedTestnetChainId = ARC_TESTNET_CHAIN_ID;

export function isSupportedTestnetChainId(id: number): id is SupportedTestnetChainId {
  return (SUPPORTED_TESTNET_CHAIN_IDS as readonly number[]).includes(id);
}

export interface ChainInfo {
  id: SupportedTestnetChainId;
  shortName: string;
  displayName: string;
  /** `<base>/tx/<hash>` for transaction links; `<base>/address/<addr>` for address pages. */
  explorerUrl: string;
}

export const CHAIN_INFO: Record<SupportedTestnetChainId, ChainInfo> = {
  [BASE_SEPOLIA_CHAIN_ID]: {
    id: BASE_SEPOLIA_CHAIN_ID,
    shortName: "Base",
    displayName: "Base Sepolia",
    explorerUrl: "https://sepolia.basescan.org",
  },
  [ARC_TESTNET_CHAIN_ID]: {
    id: ARC_TESTNET_CHAIN_ID,
    shortName: "Arc",
    displayName: "Arc Testnet",
    explorerUrl: "https://testnet.arcscan.app",
  },
};

export function getChainInfo(chainId: SupportedTestnetChainId): ChainInfo {
  return CHAIN_INFO[chainId];
}

export function getExplorerTxUrl(chainId: SupportedTestnetChainId, txHash: string): string {
  return `${CHAIN_INFO[chainId].explorerUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(chainId: SupportedTestnetChainId, address: string): string {
  return `${CHAIN_INFO[chainId].explorerUrl}/address/${address}`;
}

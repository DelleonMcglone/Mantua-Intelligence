/**
 * Supported chains.
 *
 * Scope: **Arc Testnet (5042002) only.** Mantua builds exclusively on
 * Arc, Circle's USDC-gas chain. Base (Sepolia + Mainnet) support has been
 * removed. Per-chain config (v4 contracts, hook addresses, token
 * registry) is keyed by chainId in the modules that own each concern —
 * see `v4-contracts.ts`, `tokens.ts`, `hook-pair-gating.ts`.
 */

export const ARC_TESTNET_CHAIN_ID = 5042002 as const;

/** Chains that can carry a user-initiated transaction. */
export const SUPPORTED_TESTNET_CHAIN_IDS = [ARC_TESTNET_CHAIN_ID] as const;

export type SupportedTestnetChainId = (typeof SUPPORTED_TESTNET_CHAIN_IDS)[number];

/** Default chain when a request omits chainId. */
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

export function getExplorerAddressUrl(
  chainId: SupportedTestnetChainId,
  address: string,
): string {
  return `${CHAIN_INFO[chainId].explorerUrl}/address/${address}`;
}

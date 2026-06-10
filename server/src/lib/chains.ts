/**
 * Supported chains.
 *
 * Scope: Base Sepolia (84532) only. The compile-time `IS_MAINNET` flag
 * from `constants.ts` is preserved for the eventual mainnet launch but
 * mainnet is single-chain (Base Mainnet) and out of scope for this beta.
 *
 * Per-chain config (v4 contracts, hook addresses, token registry) is
 * keyed by chainId in the modules that own each concern — see
 * `v4-contracts.ts`, `tokens.ts`, `hook-pair-gating.ts`.
 */

export const BASE_MAINNET_CHAIN_ID = 8453 as const;
export const BASE_SEPOLIA_CHAIN_ID = 84532 as const;
export const ARC_TESTNET_CHAIN_ID = 5042002 as const;

/**
 * Chains that can carry a user-initiated transaction. When IS_MAINNET
 * flips to true the supported set collapses to Base Mainnet only —
 * mainnet redeploy of the hooks is launch-gating, separate work.
 */
export const SUPPORTED_TESTNET_CHAIN_IDS = [
  BASE_SEPOLIA_CHAIN_ID,
  ARC_TESTNET_CHAIN_ID,
] as const;

export type SupportedTestnetChainId = (typeof SUPPORTED_TESTNET_CHAIN_IDS)[number];

/**
 * Default chain when a request omits chainId. New code MUST pass
 * chainId explicitly; this is here so legacy single-chain call sites
 * keep their Base Sepolia behavior.
 */
export const DEFAULT_CHAIN_ID: SupportedTestnetChainId = BASE_SEPOLIA_CHAIN_ID;

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
    shortName: "Base Sepolia",
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

export function getExplorerAddressUrl(
  chainId: SupportedTestnetChainId,
  address: string,
): string {
  return `${CHAIN_INFO[chainId].explorerUrl}/address/${address}`;
}

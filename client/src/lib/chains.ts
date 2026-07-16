/**
 * Supported chains.
 *
 * Scope: **Arc Testnet (5042002) only.** Mantua builds exclusively on
 * Arc, Circle's USDC-gas chain. Base (Sepolia + Mainnet) support has been
 * removed. Per-chain config (v4 contracts, hook addresses, token
 * registry, RPC URL) is keyed by chainId in the modules that own each
 * concern, leaving room to add Arc Mainnet later.
 */

import { fallback, http, type FallbackTransport } from "viem";
import { arcTestnet as viemArcTestnet, type Chain } from "viem/chains";
import { cleanEnv } from "./env.ts";

/**
 * Arc's three public RPC hosts. The primary rate-limits under load
 * ("request limit reached"), so reads use a fallback transport across all
 * of them (see getRpcTransport) and wallet traffic gets a different
 * primary host (below).
 */
const PUBLIC_ARC_RPC_URLS = [
  "https://rpc.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network",
] as const;

/**
 * Chain definition handed to Privy (defaultChain/supportedChains) and to
 * every walletClient. The embedded wallet's own JSON-RPC traffic
 * (eth_gasPrice / eth_estimateGas / eth_sendRawTransaction) uses
 * `rpcUrls.default.http[0]` directly — no fallback — so writes were
 * competing with the app's read traffic on the same overloaded primary
 * host and 429-ing ("Custom eth_gasPrice: Request is being rate
 * limited"). Reorder the hosts so wallet ops start on Blockdaemon while
 * reads start on the main host; a VITE_ARC_RPC_URL override goes first.
 */
const walletRpcOverride = cleanEnv(import.meta.env.VITE_ARC_RPC_URL as string | undefined);
const WALLET_RPC_URLS = [
  ...(walletRpcOverride ? [walletRpcOverride] : []),
  "https://rpc.blockdaemon.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
  "https://rpc.testnet.arc.network",
];

// Inferred type (not annotated `: Chain`): Privy's PrivyClientConfig wants its
// own structurally-compatible Chain type, which viem's *generic* Chain doesn't
// unify with under exactOptionalPropertyTypes — the spread's inferred literal
// type satisfies both.
export const arcTestnet = {
  ...viemArcTestnet,
  rpcUrls: {
    ...viemArcTestnet.rpcUrls,
    default: { http: WALLET_RPC_URLS },
  },
} satisfies Chain;

export const ARC_TESTNET_CHAIN_ID = 5042002 as const;

/**
 * Arc Testnet — Circle's public testnet (chain id 5042002), where USDC
 * is the native gas token: native gas uses 18 decimals, while the USDC
 * ERC-20 (0x3600…0000 in `tokens.ts`) uses 6. viem ships this chain
 * natively; we export the customized copy above (wallet-first RPC order)
 * for the Privy config + per-chain RPC.
 */

export const SUPPORTED_TESTNET_CHAIN_IDS = [ARC_TESTNET_CHAIN_ID] as const;

export type SupportedTestnetChainId = (typeof SUPPORTED_TESTNET_CHAIN_IDS)[number];

/** The single active chain id. */
export const DEFAULT_CHAIN_ID: SupportedTestnetChainId = ARC_TESTNET_CHAIN_ID;

export function isSupportedTestnetChainId(id: number): id is SupportedTestnetChainId {
  return (SUPPORTED_TESTNET_CHAIN_IDS as readonly number[]).includes(id);
}

export interface ChainInfo {
  id: SupportedTestnetChainId;
  shortName: string;
  displayName: string;
  viemChain: Chain;
  /** Public RPC URL. Override per env via `VITE_ARC_RPC_URL`. */
  defaultRpcUrl: string;
  /** `<base>/tx/<hash>` for transaction links; `<base>/address/<addr>` for addresses. */
  explorerUrl: string;
  explorerName: string;
  /** Brand-color dot for the chain chip. */
  dotColor: string;
}

export const CHAIN_INFO: Record<SupportedTestnetChainId, ChainInfo> = {
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
 * Network options for the chatbot's network chip. Single entry (Arc)
 * while Arc is the only chain; the chip renders statically.
 */
export type NetworkKey = "arc";

export interface NetworkOption {
  key: NetworkKey;
  shortName: string;
  displayName: string;
  /** Brand-color dot for the chip. */
  dotColor: string;
  dataChainId: SupportedTestnetChainId;
}

export const NETWORK_OPTIONS: NetworkOption[] = [
  {
    key: "arc",
    shortName: CHAIN_INFO[ARC_TESTNET_CHAIN_ID].shortName,
    displayName: CHAIN_INFO[ARC_TESTNET_CHAIN_ID].displayName,
    dotColor: CHAIN_INFO[ARC_TESTNET_CHAIN_ID].dotColor,
    dataChainId: ARC_TESTNET_CHAIN_ID,
  },
];

export const DEFAULT_NETWORK_KEY: NetworkKey = "arc";

export function isNetworkKey(s: string): s is NetworkKey {
  return s === "arc";
}

export function getExplorerTxUrl(chainId: SupportedTestnetChainId, txHash: string): string {
  return `${CHAIN_INFO[chainId].explorerUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(chainId: SupportedTestnetChainId, address: string): string {
  return `${CHAIN_INFO[chainId].explorerUrl}/address/${address}`;
}

/**
 * Resolve the RPC URL for a chain. Falls back to the public Arc endpoint;
 * overridable by setting `VITE_ARC_RPC_URL` in `client/.env.local`.
 */
export function getRpcUrl(chainId: SupportedTestnetChainId): string {
  return (
    cleanEnv(import.meta.env.VITE_ARC_RPC_URL as string | undefined) ||
    CHAIN_INFO[chainId].defaultRpcUrl
  );
}

/**
 * Hardened viem transport for browser-side public clients: rotates across
 * the public Arc RPC hosts when one errors or rate-limits, batches
 * concurrent JSON-RPC calls into one HTTP request, and retries transient
 * failures. A `VITE_ARC_RPC_URL` override goes first in the rotation.
 * Use this instead of `http(getRpcUrl(chainId))`.
 */
export function getRpcTransport(chainId: SupportedTestnetChainId): FallbackTransport {
  const override = cleanEnv(import.meta.env.VITE_ARC_RPC_URL as string | undefined);
  const base = override || CHAIN_INFO[chainId].defaultRpcUrl;
  const urls = [base, ...PUBLIC_ARC_RPC_URLS.filter((u) => u !== base)];
  return fallback(urls.map((url) => http(url, { batch: true, retryCount: 1, retryDelay: 300 })));
}

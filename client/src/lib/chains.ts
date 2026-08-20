/**
 * Supported chains: **Base Sepolia (84532, default)** and **Arc Testnet
 * (5042002)**. Per-chain config (v4 contracts, hook addresses, token
 * registry, RPC URL) is keyed by chainId in the modules that own each
 * concern.
 */

import { fallback, http, type FallbackTransport } from "viem";
import {
  arcTestnet as viemArcTestnet,
  baseSepolia as viemBaseSepolia,
  type Chain,
} from "viem/chains";
import { cleanEnv } from "./env.ts";

// `import.meta.env` only exists under Vite — node-based test runners load
// this module too (via hook-recommendations et al.), so read defensively.
const viteEnv: Record<string, string | undefined> =
  (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

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
const walletRpcOverride = cleanEnv(viteEnv["VITE_ARC_RPC_URL"]);
/**
 * Same-origin server proxy (`/api/rpc`) goes first: it rotates across all
 * three public hosts server-side and caches hot calls (eth_gasPrice), so
 * wallet-originated RPC — including what Privy's embedded wallet fetches on
 * its own — stops dying on per-IP rate limits. Public hosts remain as
 * fallbacks (and cover non-browser contexts where `window` is undefined).
 */
const rpcProxyUrl = typeof window === "undefined" ? null : `${window.location.origin}/api/rpc`;
const WALLET_RPC_URLS = [
  ...(walletRpcOverride ? [walletRpcOverride] : []),
  ...(rpcProxyUrl ? [rpcProxyUrl] : []),
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

/**
 * Base Sepolia — Base's public testnet (84532), ETH gas. The public RPC
 * (`https://sepolia.base.org`) has no per-IP pathology like Arc's hosts,
 * so no proxy/fallback reorder is needed; a `VITE_BASE_SEPOLIA_RPC_URL`
 * override still goes first when set.
 */
const baseRpcOverride = cleanEnv(viteEnv["VITE_BASE_SEPOLIA_RPC_URL"]);
const BASE_SEPOLIA_RPC_URLS = [
  ...(baseRpcOverride ? [baseRpcOverride] : []),
  "https://sepolia.base.org",
];

export const baseSepolia = {
  ...viemBaseSepolia,
  rpcUrls: {
    ...viemBaseSepolia.rpcUrls,
    default: { http: BASE_SEPOLIA_RPC_URLS },
  },
} satisfies Chain;

export const ARC_TESTNET_CHAIN_ID = 5042002 as const;
export const BASE_SEPOLIA_CHAIN_ID = 84532 as const;

/**
 * Arc Testnet — Circle's public testnet (chain id 5042002), where USDC
 * is the native gas token: native gas uses 18 decimals, while the USDC
 * ERC-20 (0x3600…0000 in `tokens.ts`) uses 6. viem ships this chain
 * natively; we export the customized copy above (wallet-first RPC order)
 * for the Privy config + per-chain RPC.
 */

export const SUPPORTED_TESTNET_CHAIN_IDS = [BASE_SEPOLIA_CHAIN_ID, ARC_TESTNET_CHAIN_ID] as const;

export type SupportedTestnetChainId = (typeof SUPPORTED_TESTNET_CHAIN_IDS)[number];

/** The default chain — Base Sepolia. */
export const DEFAULT_CHAIN_ID: SupportedTestnetChainId = BASE_SEPOLIA_CHAIN_ID;

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
  [BASE_SEPOLIA_CHAIN_ID]: {
    id: BASE_SEPOLIA_CHAIN_ID,
    shortName: "Base",
    displayName: "Base Sepolia",
    viemChain: baseSepolia,
    defaultRpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
    explorerName: "BaseScan",
    dotColor: "#0000ff",
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
 * Network options for the chain selector chips. Base first (default).
 */
export type NetworkKey = "base" | "arc";

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

/** NetworkKey for a chain id — the logo/chip lookup. */
export function networkKeyForChain(chainId: SupportedTestnetChainId): NetworkKey {
  return chainId === BASE_SEPOLIA_CHAIN_ID ? "base" : "arc";
}

export function getExplorerTxUrl(chainId: SupportedTestnetChainId, txHash: string): string {
  return `${CHAIN_INFO[chainId].explorerUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(chainId: SupportedTestnetChainId, address: string): string {
  return `${CHAIN_INFO[chainId].explorerUrl}/address/${address}`;
}

/**
 * Resolve the RPC URL for a chain. Overridable per chain via
 * `VITE_ARC_RPC_URL` / `VITE_BASE_SEPOLIA_RPC_URL` in `client/.env.local`.
 */
export function getRpcUrl(chainId: SupportedTestnetChainId): string {
  const override =
    chainId === BASE_SEPOLIA_CHAIN_ID
      ? cleanEnv(viteEnv["VITE_BASE_SEPOLIA_RPC_URL"])
      : cleanEnv(viteEnv["VITE_ARC_RPC_URL"]);
  return override || CHAIN_INFO[chainId].defaultRpcUrl;
}

/**
 * Hardened viem transport for browser-side public clients.
 *
 * Arc: the public hosts rate-limit PER IP — and the app's own polling
 * (portfolio, pools, quotes) exhausts the user's browser-IP budget on all
 * three hosts, after which rotation just cycles between three closed doors
 * (and Privy's own gas lookups die too). So Arc browser reads go through
 * the same-origin `/api/rpc` proxy FIRST (server-side rotation + hot-call
 * caching), with the public hosts as direct fallbacks and a
 * `VITE_ARC_RPC_URL` override first.
 *
 * Base Sepolia: `https://sepolia.base.org` has no such pathology, so it is
 * hit directly (the `/api/rpc` proxy is Arc-only and is NOT in this list).
 * Use this instead of `http(getRpcUrl(chainId))`.
 */
export function getRpcTransport(chainId: SupportedTestnetChainId): FallbackTransport {
  const urls =
    chainId === BASE_SEPOLIA_CHAIN_ID
      ? BASE_SEPOLIA_RPC_URLS
      : [
          ...(walletRpcOverride ? [walletRpcOverride] : []),
          ...(rpcProxyUrl ? [rpcProxyUrl] : []),
          ...PUBLIC_ARC_RPC_URLS,
        ];
  return fallback(urls.map((url) => http(url, { batch: true, retryCount: 1, retryDelay: 300 })));
}

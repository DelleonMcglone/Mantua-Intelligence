import type { AppKit } from "@circle-fin/app-kit";
import type { EIP1193Provider } from "viem";
import type { ConnectedWallet } from "@privy-io/react-auth";

/**
 * Circle App Kit foundation (client-side).
 *
 * App Kit drives Bridge (CCTP v2), Send, and Unified Balance (Gateway v1)
 * directly from the user's Privy wallet — the server never holds a key.
 * Swaps, pools, and liquidity stay on the Arc-only Uniswap-v4 path; the
 * multi-chain surface below is scoped to the bridge feature alone.
 *
 * The SDK is heavy (~600 KB gzip), so every entry point dynamic-imports it.
 * That keeps it out of the main bundle and loads it only when the user
 * opens the Bridge panel.
 */

export type BridgeChainKey =
  | "arc"
  | "ethereum-sepolia"
  | "base-sepolia"
  | "arbitrum-sepolia"
  | "unichain-sepolia";

/** Export names of the corresponding chain definitions in `@circle-fin/app-kit/chains`. */
type AppKitChainName =
  | "ArcTestnet"
  | "EthereumSepolia"
  | "BaseSepolia"
  | "ArbitrumSepolia"
  | "UnichainSepolia";

export interface BridgeChain {
  readonly key: BridgeChainKey;
  readonly chainId: number;
  readonly label: string;
  /** Identifier used to look up the App Kit `ChainDefinition`. */
  readonly appKitName: AppKitChainName;
  /** Arc Testnet — the app's home chain and the default bridge counterpart. */
  readonly isHome: boolean;
}

/**
 * Chains the bridge can move USDC between. All five carry both `cctp`
 * (bridge) and `gateway` (unified balance) config in App Kit's registry.
 * USDC is the only CCTP/Gateway asset — EURC/cirBTC live on Arc only.
 */
export const BRIDGE_CHAINS: readonly BridgeChain[] = [
  { key: "arc", chainId: 5042002, label: "Arc Testnet", appKitName: "ArcTestnet", isHome: true },
  {
    key: "ethereum-sepolia",
    chainId: 11155111,
    label: "Ethereum Sepolia",
    appKitName: "EthereumSepolia",
    isHome: false,
  },
  {
    key: "base-sepolia",
    chainId: 84532,
    label: "Base Sepolia",
    appKitName: "BaseSepolia",
    isHome: false,
  },
  {
    key: "arbitrum-sepolia",
    chainId: 421614,
    label: "Arbitrum Sepolia",
    appKitName: "ArbitrumSepolia",
    isHome: false,
  },
  {
    key: "unichain-sepolia",
    chainId: 1301,
    label: "Unichain Sepolia",
    appKitName: "UnichainSepolia",
    isHome: false,
  },
];

export function bridgeChainByKey(key: BridgeChainKey): BridgeChain {
  const found = BRIDGE_CHAINS.find((c) => c.key === key);
  if (!found) throw new Error(`Unknown bridge chain: ${key}`);
  return found;
}

export function bridgeChainByChainId(chainId: number): BridgeChain | null {
  return BRIDGE_CHAINS.find((c) => c.chainId === chainId) ?? null;
}

/** Lazy App Kit singleton — instantiated on first use, reused thereafter. */
let kitPromise: Promise<AppKit> | null = null;
export async function getAppKit(): Promise<AppKit> {
  kitPromise ??= import("@circle-fin/app-kit").then((m) => new m.AppKit());
  return kitPromise;
}

/** Resolve a bridge chain key to its App Kit `ChainDefinition`. */
export async function getBridgeChainDef(key: BridgeChainKey) {
  const chains = await import("@circle-fin/app-kit/chains");
  return chains[bridgeChainByKey(key).appKitName];
}

/**
 * Build an App Kit viem adapter backed by the user's Privy wallet. The
 * adapter handles per-chain wallet clients and EIP-1193 chain switching
 * internally, so a single adapter serves every bridge chain.
 *
 * Privy's `getEthereumProvider()` returns an EIP-1193 provider; the cast
 * bridges Privy's provider type to viem's `EIP1193Provider`.
 */
export async function createWalletAdapter(wallet: ConnectedWallet) {
  const { createViemAdapterFromProvider } = await import("@circle-fin/adapter-viem-v2");
  const provider = await wallet.getEthereumProvider();
  return createViemAdapterFromProvider({ provider: provider as EIP1193Provider });
}

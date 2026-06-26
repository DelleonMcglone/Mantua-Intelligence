/**
 * Outbound bridge destinations (USDC, CCTP V2) from Arc Testnet. Only chains
 * Circle's CCTP supports are bridgeable — Chainlink (an oracle network) and
 * Robinhood are NOT chains and can't be a CCTP destination, so they're absent.
 *
 * `sdkName` is the exact Bridge Kit string chain identifier (the SDK's
 * `chain:` param also accepts these literals). If a route turns out not to
 * support the Forwarding Service at runtime the bridge surfaces a clear
 * "route unavailable" message (see use-bridge.ts).
 */
export type BridgeChainName =
  | "Base_Sepolia"
  | "Ethereum_Sepolia"
  | "Arbitrum_Sepolia"
  | "Unichain_Sepolia"
  | "Avalanche_Fuji";

export interface BridgeDestination {
  sdkName: BridgeChainName;
  label: string;
  /** CCTP domain — shown for reference, not used in the SDK call. */
  cctpDomain: number;
  explorerTxUrl: (hash: string) => string;
}

/** Source is fixed: the app lives on Arc Testnet. */
export const SOURCE_CHAIN = "Arc_Testnet" as const;

/** Word/alias → destination, for parsing typed bridge commands. Order matters:
 *  more specific aliases first so "arbitrum" doesn't swallow "arb" etc. */
const DESTINATION_ALIASES: { sdkName: BridgeChainName; aliases: RegExp }[] = [
  { sdkName: "Base_Sepolia", aliases: /\bbase\b/ },
  { sdkName: "Arbitrum_Sepolia", aliases: /\b(arbitrum|arb)\b/ },
  { sdkName: "Unichain_Sepolia", aliases: /\b(unichain|uni)\b/ },
  { sdkName: "Avalanche_Fuji", aliases: /\b(avalanche|avax|fuji)\b/ },
  // Ethereum last: plain "sepolia"/"eth"/"ethereum" → Ethereum Sepolia only if
  // none of the more specific chains matched above.
  { sdkName: "Ethereum_Sepolia", aliases: /\b(ethereum|eth|sepolia|mainnet)\b/ },
];

/** Match a destination chain from free text ("bridge 10 USDC to base"). */
export function matchBridgeDestination(text: string): BridgeDestination | undefined {
  const t = text.toLowerCase();
  for (const { sdkName, aliases } of DESTINATION_ALIASES) {
    if (aliases.test(t)) return BRIDGE_DESTINATIONS.find((d) => d.sdkName === sdkName);
  }
  return undefined;
}

export const BRIDGE_DESTINATIONS: BridgeDestination[] = [
  {
    sdkName: "Base_Sepolia",
    label: "Base Sepolia",
    cctpDomain: 6,
    explorerTxUrl: (h) => `https://sepolia.basescan.org/tx/${h}`,
  },
  {
    sdkName: "Ethereum_Sepolia",
    label: "Ethereum Sepolia",
    cctpDomain: 0,
    explorerTxUrl: (h) => `https://sepolia.etherscan.io/tx/${h}`,
  },
  {
    sdkName: "Arbitrum_Sepolia",
    label: "Arbitrum Sepolia",
    cctpDomain: 3,
    explorerTxUrl: (h) => `https://sepolia.arbiscan.io/tx/${h}`,
  },
  {
    sdkName: "Unichain_Sepolia",
    label: "Unichain Sepolia",
    cctpDomain: 10,
    explorerTxUrl: (h) => `https://sepolia.uniscan.xyz/tx/${h}`,
  },
  {
    sdkName: "Avalanche_Fuji",
    label: "Avalanche Fuji",
    cctpDomain: 1,
    explorerTxUrl: (h) => `https://testnet.snowtrace.io/tx/${h}`,
  },
];

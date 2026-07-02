/**
 * Outbound bridge destinations (USDC, CCTP V2) from Arc Testnet. Every CCTP-V2
 * testnet chain Bridge Kit can reach is listed — typing "bridge 10 USDC to Sei"
 * selects the matching card. (Chainlink and Robinhood are NOT chains and can't
 * be CCTP destinations, so they're absent; Solana is skipped because the app
 * only holds an EVM recipient address.)
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
  | "Avalanche_Fuji"
  | "Optimism_Sepolia"
  | "Polygon_Amoy_Testnet"
  | "Linea_Sepolia"
  | "Sonic_Testnet"
  | "World_Chain_Sepolia"
  | "Sei_Testnet"
  | "HyperEVM_Testnet";

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
  { sdkName: "Optimism_Sepolia", aliases: /\b(optimism|op)\b/ },
  { sdkName: "Polygon_Amoy_Testnet", aliases: /\b(polygon|matic|amoy)\b/ },
  { sdkName: "Linea_Sepolia", aliases: /\blinea\b/ },
  { sdkName: "Sonic_Testnet", aliases: /\bsonic\b/ },
  { sdkName: "World_Chain_Sepolia", aliases: /\b(world[\s-]?chain|world)\b/ },
  { sdkName: "Sei_Testnet", aliases: /\bsei\b/ },
  { sdkName: "HyperEVM_Testnet", aliases: /\b(hyperevm|hyperliquid|hyper)\b/ },
  // Ethereum last: plain "sepolia"/"eth"/"ethereum" → Ethereum Sepolia only if
  // none of the more specific chains matched above.
  { sdkName: "Ethereum_Sepolia", aliases: /\b(ethereum|eth|sepolia|mainnet)\b/ },
];

/** Match a destination chain from free text ("bridge 10 USDC to sei"). */
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
  {
    sdkName: "Optimism_Sepolia",
    label: "OP Sepolia",
    cctpDomain: 2,
    explorerTxUrl: (h) => `https://sepolia-optimism.etherscan.io/tx/${h}`,
  },
  {
    sdkName: "Polygon_Amoy_Testnet",
    label: "Polygon Amoy",
    cctpDomain: 7,
    explorerTxUrl: (h) => `https://amoy.polygonscan.com/tx/${h}`,
  },
  {
    sdkName: "Linea_Sepolia",
    label: "Linea Sepolia",
    cctpDomain: 11,
    explorerTxUrl: (h) => `https://sepolia.lineascan.build/tx/${h}`,
  },
  {
    sdkName: "Sonic_Testnet",
    label: "Sonic Testnet",
    cctpDomain: 13,
    explorerTxUrl: (h) => `https://testnet.sonicscan.org/tx/${h}`,
  },
  {
    sdkName: "World_Chain_Sepolia",
    label: "World Chain Sepolia",
    cctpDomain: 14,
    explorerTxUrl: (h) => `https://sepolia.worldscan.org/tx/${h}`,
  },
  {
    sdkName: "Sei_Testnet",
    label: "Sei Testnet",
    cctpDomain: 16,
    explorerTxUrl: (h) => `https://seitrace.com/tx/${h}?chain=atlantic-2`,
  },
  {
    sdkName: "HyperEVM_Testnet",
    label: "HyperEVM Testnet",
    cctpDomain: 19,
    explorerTxUrl: (h) => `https://testnet.purrsec.com/tx/${h}`,
  },
];

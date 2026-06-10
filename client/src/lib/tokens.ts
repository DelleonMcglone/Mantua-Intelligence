/**
 * P3-002 — client mirror of `server/src/lib/tokens.ts`. Keep in sync.
 * Runtime per-chain: pass `chainId` explicitly (`getTokens(chainId)`)
 * for new code. Legacy `TOKENS` export defaults to Base Sepolia.
 */

import {
  ARC_TESTNET_CHAIN_ID,
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  type SupportedTestnetChainId,
  CHAIN_INFO,
} from "./chains.ts";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export const NETWORK: "mainnet" | "testnet" =
  import.meta.env.VITE_MANTUA_NETWORK === "mainnet" ? "mainnet" : "testnet";
export const IS_MAINNET = NETWORK === "mainnet";

/**
 * Legacy single-chain id (compile-time). New code should use
 * `useCurrentChainId()` from `ChainContext` for runtime chain selection.
 */
export const BASE_CHAIN_ID: number = IS_MAINNET ? BASE_MAINNET_CHAIN_ID : BASE_SEPOLIA_CHAIN_ID;

/** Legacy single-chain export. Prefer `getChainInfo(chainId).explorerUrl`. */
export const BASESCAN_URL = CHAIN_INFO[BASE_SEPOLIA_CHAIN_ID].explorerUrl;
/** Legacy single-chain export. Prefer `getExplorerTxUrl(chainId, hash)`. */
export const BASESCAN_TX = `${BASESCAN_URL}/tx/`;

const V4_POSITION_MANAGER_BY_CHAIN: Record<SupportedTestnetChainId, `0x${string}`> = {
  [BASE_SEPOLIA_CHAIN_ID]: "0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80",
  // TODO: replace with the real Arc Testnet v4 PositionManager once Uniswap
  // v4 is deployed there. Placeholder so on-chain pool ops on Arc fail loudly
  // rather than the registry being type-incomplete.
  [ARC_TESTNET_CHAIN_ID]: "0x0000000000000000000000000000000000000000",
};

/**
 * v4 PositionManager — per-chain. Returns the deployment for the given
 * chainId; for mainnet (out of scope for this beta) returns the Base
 * Mainnet PositionManager.
 */
export function getV4PositionManager(chainId: SupportedTestnetChainId): `0x${string}` {
  if (IS_MAINNET) return "0x7c5f5a4bbd8fd63184577525326123b519429bdc";
  return V4_POSITION_MANAGER_BY_CHAIN[chainId];
}

/** Legacy single-chain export. Prefer `getV4PositionManager(chainId)`. */
export const V4_POSITION_MANAGER: `0x${string}` = IS_MAINNET
  ? "0x7c5f5a4bbd8fd63184577525326123b519429bdc"
  : V4_POSITION_MANAGER_BY_CHAIN[BASE_SEPOLIA_CHAIN_ID];

export interface Token {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  coingeckoId: string;
  native: boolean;
  chainId: number;
}

const TOKENS_BASE_MAINNET = {
  ETH: { symbol: "ETH", name: "Ethereum", address: ZERO_ADDRESS, decimals: 18, coingeckoId: "ethereum", native: true, chainId: BASE_MAINNET_CHAIN_ID },
  cbBTC: { symbol: "cbBTC", name: "Coinbase Wrapped BTC", address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", decimals: 8, coingeckoId: "coinbase-wrapped-btc", native: false, chainId: BASE_MAINNET_CHAIN_ID },
  USDC: { symbol: "USDC", name: "USD Coin", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, coingeckoId: "usd-coin", native: false, chainId: BASE_MAINNET_CHAIN_ID },
  EURC: { symbol: "EURC", name: "Euro Coin", address: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42", decimals: 6, coingeckoId: "euro-coin", native: false, chainId: BASE_MAINNET_CHAIN_ID },
} as const satisfies Record<string, Token>;

const TOKENS_BASE_SEPOLIA = {
  ETH: { symbol: "ETH", name: "Ethereum", address: ZERO_ADDRESS, decimals: 18, coingeckoId: "ethereum", native: true, chainId: BASE_SEPOLIA_CHAIN_ID },
  WETH: { symbol: "WETH", name: "Wrapped Ether", address: "0x4200000000000000000000000000000000000006", decimals: 18, coingeckoId: "weth", native: false, chainId: BASE_SEPOLIA_CHAIN_ID },
  cbBTC: { symbol: "cbBTC", name: "Coinbase Wrapped BTC", address: "0xcbB7C0006F23900c38EB856149F799620fcb8A4a", decimals: 8, coingeckoId: "coinbase-wrapped-btc", native: false, chainId: BASE_SEPOLIA_CHAIN_ID },
  USDC: { symbol: "USDC", name: "USD Coin", address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6, coingeckoId: "usd-coin", native: false, chainId: BASE_SEPOLIA_CHAIN_ID },
  EURC: { symbol: "EURC", name: "Euro Coin", address: "0x808456652fdb597867f38412077A9182bf77359F", decimals: 6, coingeckoId: "euro-coin", native: false, chainId: BASE_SEPOLIA_CHAIN_ID },
} as const satisfies Record<string, Token>;

// Arc Testnet token set (addresses per Circle's use-arc skill / Arc docs).
// USDC is Arc's NATIVE gas token (like ETH on Base): the user's spendable
// balance is the native balance, read via getBalance with 18 decimals —
// NOT balanceOf on the 0x3600…0000 precompile (which isn't a standard
// ERC-20 and returns 0). EURC and cirBTC are regular ERC-20s. cirBTC is
// not in Circle's official token table (caller-provided, no CoinGecko id).
const TOKENS_ARC_TESTNET = {
  USDC: { symbol: "USDC", name: "USD Coin", address: "0x3600000000000000000000000000000000000000", decimals: 18, coingeckoId: "usd-coin", native: true, chainId: ARC_TESTNET_CHAIN_ID },
  EURC: { symbol: "EURC", name: "Euro Coin", address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6, coingeckoId: "euro-coin", native: false, chainId: ARC_TESTNET_CHAIN_ID },
  cirBTC: { symbol: "cirBTC", name: "Circle Wrapped BTC", address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF", decimals: 8, coingeckoId: "", native: false, chainId: ARC_TESTNET_CHAIN_ID },
} as const satisfies Record<string, Token>;

export type TokenSymbol =
  | keyof typeof TOKENS_BASE_MAINNET
  | keyof typeof TOKENS_BASE_SEPOLIA
  | keyof typeof TOKENS_ARC_TESTNET;

const TOKENS_BY_CHAIN: Record<SupportedTestnetChainId, Record<string, Token>> = {
  [BASE_SEPOLIA_CHAIN_ID]: TOKENS_BASE_SEPOLIA,
  [ARC_TESTNET_CHAIN_ID]: TOKENS_ARC_TESTNET,
};

export function getTokens(chainId: SupportedTestnetChainId): Record<string, Token> {
  if (IS_MAINNET) return TOKENS_BASE_MAINNET as Record<string, Token>;
  return TOKENS_BY_CHAIN[chainId];
}

export function getToken(
  symbol: string,
  chainId: SupportedTestnetChainId = BASE_SEPOLIA_CHAIN_ID,
): Token {
  const tokens = getTokens(chainId);
  const t = tokens[symbol];
  if (!t) throw new Error(`Unknown token on chain ${String(chainId)}: ${symbol}`);
  return t;
}

export function isTokenSymbol(
  s: string,
  chainId: SupportedTestnetChainId = BASE_SEPOLIA_CHAIN_ID,
): s is TokenSymbol {
  return Object.prototype.hasOwnProperty.call(getTokens(chainId), s);
}

/**
 * User-facing token list for a given chain — what shows in the swap /
 * liquidity selectors. WETH is excluded (the contract layer wraps ETH
 * on demand and the UX is "always ETH").
 */
export function getUserFacingTokenSymbols(chainId: SupportedTestnetChainId): TokenSymbol[] {
  const all = Object.keys(getTokens(chainId)) as TokenSymbol[];
  return all.filter((s): s is TokenSymbol => s !== "WETH");
}

/**
 * Legacy single-chain export. Prefer `getTokens(chainId)`. Defaults
 * to Base Sepolia / Base Mainnet for callsites not yet migrated.
 */
export const TOKENS: Record<string, Token> = IS_MAINNET
  ? TOKENS_BASE_MAINNET
  : TOKENS_BASE_SEPOLIA;

export const TOKEN_SYMBOLS = Object.keys(TOKENS) as TokenSymbol[];
export const USER_FACING_TOKEN_SYMBOLS = TOKEN_SYMBOLS.filter(
  (s): s is TokenSymbol => s !== "WETH",
);

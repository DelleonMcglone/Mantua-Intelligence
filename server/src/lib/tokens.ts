/**
 * Phase 3 / P3-002 — supported token registry, runtime per-chain.
 *
 * Source of truth. Mirrored by `client/src/lib/tokens.ts`. Keep both in
 * sync; tokens themselves are duplicated values.
 *
 * Active set is keyed by chainId (`getTokens(chainId)`). The compile-
 * time `IS_MAINNET` flag from `constants.ts` is preserved for the
 * mainnet launch but mainnet is single-chain (Base Mainnet) and out of
 * scope for this beta — when IS_MAINNET=true we return the mainnet
 * registry regardless of chainId argument.
 *
 * Address sources:
 *   - Base Mainnet (8453): issuer docs per P1-002.
 *   - Base Sepolia (84532): cbBTC RPC-probed, USDC/EURC are Circle's
 *     official testnet tokens, WETH is the canonical OP-stack address.
 */

import {
  ARC_TESTNET_CHAIN_ID,
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  DEFAULT_CHAIN_ID,
  type SupportedTestnetChainId,
} from "./chains.ts";
import { IS_MAINNET } from "./constants.ts";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

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
// On Arc, USDC is the native gas token — native gas uses 18 decimals,
// while the USDC ERC-20 below (0x3600…0000) uses 6. cirBTC is not in
// Circle's official token table; address is caller-provided, no CoinGecko
// listing yet. Mirror of client/src/lib/tokens.ts — keep both in sync.
const TOKENS_ARC_TESTNET = {
  USDC: { symbol: "USDC", name: "USD Coin", address: "0x3600000000000000000000000000000000000000", decimals: 6, coingeckoId: "usd-coin", native: false, chainId: ARC_TESTNET_CHAIN_ID },
  EURC: { symbol: "EURC", name: "Euro Coin", address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6, coingeckoId: "euro-coin", native: false, chainId: ARC_TESTNET_CHAIN_ID },
  cirBTC: { symbol: "cirBTC", name: "Circle Wrapped BTC", address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF", decimals: 8, coingeckoId: "", native: false, chainId: ARC_TESTNET_CHAIN_ID },
} as const satisfies Record<string, Token>;

/** Union of every token symbol across networks. */
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

export function getToken(symbol: string, chainId: SupportedTestnetChainId = DEFAULT_CHAIN_ID): Token {
  const tokens = getTokens(chainId);
  const t = tokens[symbol];
  if (!t) throw new Error(`Unknown token symbol on chain ${String(chainId)}: ${symbol}`);
  return t;
}

export function isTokenSymbol(
  s: string,
  chainId: SupportedTestnetChainId = DEFAULT_CHAIN_ID,
): s is TokenSymbol {
  return Object.prototype.hasOwnProperty.call(getTokens(chainId), s);
}

/**
 * Predicate that accepts a symbol on **any** supported chain. Useful
 * for request validation when chainId isn't known yet (the route then
 * narrows to the correct chain before resolving the address).
 */
export function isAnyChainTokenSymbol(s: string): s is TokenSymbol {
  if (IS_MAINNET) return Object.prototype.hasOwnProperty.call(TOKENS_BASE_MAINNET, s);
  return (
    Object.prototype.hasOwnProperty.call(TOKENS_BASE_SEPOLIA, s) ||
    Object.prototype.hasOwnProperty.call(TOKENS_ARC_TESTNET, s)
  );
}

/**
 * Legacy single-chain export. Prefer `getTokens(chainId)`. Defaults
 * to Base Sepolia / Base Mainnet for callsites not yet migrated
 * (price history, portfolio composition, agent flows).
 */
export const TOKENS: Record<string, Token> = IS_MAINNET
  ? TOKENS_BASE_MAINNET
  : TOKENS_BASE_SEPOLIA;

export const TOKEN_SYMBOLS = Object.keys(TOKENS) as TokenSymbol[];

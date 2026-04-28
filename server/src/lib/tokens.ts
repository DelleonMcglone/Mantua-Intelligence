/**
 * Phase 3 / P3-002 — supported token registry, network-driven.
 *
 * Source of truth. Mirrored by client/src/lib/tokens.ts. Keep both in
 * sync; if either drifts, the typecheck will catch it but the tokens
 * themselves are duplicated values.
 *
 * Active set switches on `MANTUA_NETWORK` (see constants.ts):
 *   - mainnet → TOKENS_MAINNET (ETH, cbBTC, USDC, EURC)
 *     Addresses verified against issuer docs per P1-002.
 *   - testnet → TOKENS_SEPOLIA (ETH, WETH, cbBTC, USDC, EURC)
 *     Addresses verified 2026-04-28 (cbBTC checked via decimals/symbol
 *     RPC probe; USDC/EURC are Circle's official testnet tokens; WETH
 *     is the canonical OP-stack address).
 */

import { BASE_CHAIN_ID, IS_MAINNET } from "./constants.ts";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export interface Token {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  coingeckoId: string;
  /** True if this is the native chain asset (ETH on Base). */
  native: boolean;
  chainId: number;
}

const TOKENS_MAINNET = {
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    address: ZERO_ADDRESS,
    decimals: 18,
    coingeckoId: "ethereum",
    native: true,
    chainId: BASE_CHAIN_ID,
  },
  cbBTC: {
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    decimals: 8,
    coingeckoId: "coinbase-wrapped-btc",
    native: false,
    chainId: BASE_CHAIN_ID,
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    coingeckoId: "usd-coin",
    native: false,
    chainId: BASE_CHAIN_ID,
  },
  EURC: {
    symbol: "EURC",
    name: "Euro Coin",
    address: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42",
    decimals: 6,
    coingeckoId: "euro-coin",
    native: false,
    chainId: BASE_CHAIN_ID,
  },
} as const satisfies Record<string, Token>;

const TOKENS_SEPOLIA = {
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    address: ZERO_ADDRESS,
    decimals: 18,
    coingeckoId: "ethereum",
    native: true,
    chainId: BASE_CHAIN_ID,
  },
  WETH: {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    coingeckoId: "weth",
    native: false,
    chainId: BASE_CHAIN_ID,
  },
  cbBTC: {
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    address: "0xcbB7C0006F23900c38EB856149F799620fcb8A4a",
    decimals: 8,
    coingeckoId: "coinbase-wrapped-btc",
    native: false,
    chainId: BASE_CHAIN_ID,
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    decimals: 6,
    coingeckoId: "usd-coin",
    native: false,
    chainId: BASE_CHAIN_ID,
  },
  EURC: {
    symbol: "EURC",
    name: "Euro Coin",
    address: "0x808456652fdb597867f38412077A9182bf77359F",
    decimals: 6,
    coingeckoId: "euro-coin",
    native: false,
    chainId: BASE_CHAIN_ID,
  },
} as const satisfies Record<string, Token>;

export const TOKENS: Record<string, Token> = IS_MAINNET ? TOKENS_MAINNET : TOKENS_SEPOLIA;

/**
 * Union of every token symbol across networks. The active `TOKENS` map
 * only contains the subset for the current network — `getToken()` throws
 * for symbols that exist on the other network but not this one.
 */
export type TokenSymbol = keyof typeof TOKENS_MAINNET | keyof typeof TOKENS_SEPOLIA;

export const TOKEN_SYMBOLS = Object.keys(TOKENS) as TokenSymbol[];

export function getToken(symbol: string): Token {
  if (!isTokenSymbol(symbol)) {
    throw new Error(`Unknown token symbol on this network: ${symbol}`);
  }
  return TOKENS[symbol];
}

export function isTokenSymbol(s: string): s is TokenSymbol {
  return Object.prototype.hasOwnProperty.call(TOKENS, s);
}

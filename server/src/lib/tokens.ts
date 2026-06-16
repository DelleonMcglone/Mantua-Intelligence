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

import { ARC_TESTNET_CHAIN_ID, DEFAULT_CHAIN_ID, type SupportedTestnetChainId } from "./chains.ts";

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

// Arc Testnet token set (addresses per Circle's use-arc skill / Arc docs).
// USDC is Arc's native gas token, but the precompile at 0x3600…0000 also
// exposes a working ERC-20 interface (balanceOf, 6 decimals) — verified
// on-chain — so we read it as a normal ERC-20. EURC and cirBTC are
// regular ERC-20s too. cirBTC ("Circle Wrapped BTC") is BTC-pegged, so it
// prices off bitcoin's CoinGecko id.
// Mirror of client/src/lib/tokens.ts — keep both in sync.
const TOKENS_ARC_TESTNET = {
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x3600000000000000000000000000000000000000",
    decimals: 6,
    coingeckoId: "usd-coin",
    native: false,
    chainId: ARC_TESTNET_CHAIN_ID,
  },
  EURC: {
    symbol: "EURC",
    name: "Euro Coin",
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    decimals: 6,
    coingeckoId: "euro-coin",
    native: false,
    chainId: ARC_TESTNET_CHAIN_ID,
  },
  cirBTC: {
    symbol: "cirBTC",
    name: "Circle Wrapped BTC",
    address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
    decimals: 8,
    coingeckoId: "bitcoin",
    native: false,
    chainId: ARC_TESTNET_CHAIN_ID,
  },
} as const satisfies Record<string, Token>;

export type TokenSymbol = keyof typeof TOKENS_ARC_TESTNET;

const TOKENS_BY_CHAIN: Record<SupportedTestnetChainId, Record<string, Token>> = {
  [ARC_TESTNET_CHAIN_ID]: TOKENS_ARC_TESTNET,
};

export function getTokens(chainId: SupportedTestnetChainId): Record<string, Token> {
  return TOKENS_BY_CHAIN[chainId];
}

export function getToken(
  symbol: string,
  chainId: SupportedTestnetChainId = DEFAULT_CHAIN_ID,
): Token {
  const tokens = getTokens(chainId);
  // `symbol` is arbitrary input, so the index can miss at runtime; widen to
  // `| undefined` (the project has noUncheckedIndexedAccess off) to keep the
  // guard below type-correct.
  const t = tokens[symbol] as Token | undefined;
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
  return Object.prototype.hasOwnProperty.call(TOKENS_ARC_TESTNET, s);
}

/** Legacy single-chain export. Prefer `getTokens(chainId)`. */
export const TOKENS: Record<string, Token> = TOKENS_ARC_TESTNET;

export const TOKEN_SYMBOLS = Object.keys(TOKENS) as TokenSymbol[];

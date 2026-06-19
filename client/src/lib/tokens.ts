/**
 * Client mirror of `server/src/lib/tokens.ts`. Keep in sync.
 *
 * **Arc Testnet only** — the supported token set is USDC / EURC / cirBTC.
 * Pass `chainId` explicitly (`getTokens(chainId)`) for new code; the
 * legacy `TOKENS` export resolves to the single active chain.
 */

import {
  ARC_TESTNET_CHAIN_ID,
  DEFAULT_CHAIN_ID,
  type SupportedTestnetChainId,
  CHAIN_INFO,
} from "./chains.ts";
import { cleanEnv } from "./env.ts";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export const NETWORK: "mainnet" | "testnet" =
  cleanEnv(import.meta.env.VITE_MANTUA_NETWORK as string | undefined) === "mainnet"
    ? "mainnet"
    : "testnet";
export const IS_MAINNET = NETWORK === "mainnet";

/** The single active chain id (Arc Testnet). */
export const ACTIVE_CHAIN_ID: SupportedTestnetChainId = ARC_TESTNET_CHAIN_ID;

/** Block-explorer base + `/tx/` prefix for the active chain (ArcScan). */
export const EXPLORER_URL = CHAIN_INFO[ARC_TESTNET_CHAIN_ID].explorerUrl;
export const EXPLORER_TX = `${EXPLORER_URL}/tx/`;

const V4_POSITION_MANAGER_BY_CHAIN: Record<SupportedTestnetChainId, `0x${string}`> = {
  // StableProtection hero stack — deployed against PoolManager 0x15B5…0a59
  // via deploy/arc-hero-periphery (block 46501208). Server mirror:
  // server/src/lib/v4-contracts.ts V4_BY_CHAIN[arc].
  [ARC_TESTNET_CHAIN_ID]: "0x47AD8c1C78F9b07c81d833d924BbE36388A4ab78",
};

/** v4 PositionManager for the given chain. */
export function getV4PositionManager(chainId: SupportedTestnetChainId): `0x${string}` {
  return V4_POSITION_MANAGER_BY_CHAIN[chainId];
}

/** Legacy single-chain export. Prefer `getV4PositionManager(chainId)`. */
export const V4_POSITION_MANAGER: `0x${string}` =
  V4_POSITION_MANAGER_BY_CHAIN[ARC_TESTNET_CHAIN_ID];

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
// regular ERC-20s. cirBTC ("Circle Wrapped BTC") is BTC-pegged, so it is
// priced off the `bitcoin` CoinGecko id.
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
  // `symbol` is arbitrary input (user / chat), so the index can miss at
  // runtime. The map is typed `Record<string, Token>` and the project has
  // `noUncheckedIndexedAccess` off, so cast to `| undefined` to keep the
  // runtime guard below type-correct (and the throw reachable).
  const t = tokens[symbol] as Token | undefined;
  if (!t) throw new Error(`Unknown token on chain ${String(chainId)}: ${symbol}`);
  return t;
}

export function isTokenSymbol(
  s: string,
  chainId: SupportedTestnetChainId = DEFAULT_CHAIN_ID,
): s is TokenSymbol {
  return Object.prototype.hasOwnProperty.call(getTokens(chainId), s);
}

/**
 * User-facing token list for a given chain — what shows in the swap /
 * liquidity selectors. On Arc that's USDC / EURC / cirBTC.
 */
export function getUserFacingTokenSymbols(chainId: SupportedTestnetChainId): TokenSymbol[] {
  return Object.keys(getTokens(chainId)) as TokenSymbol[];
}

/** Legacy single-chain export. Prefer `getTokens(chainId)`. */
export const TOKENS: Record<string, Token> = TOKENS_ARC_TESTNET;

export const TOKEN_SYMBOLS = Object.keys(TOKENS) as TokenSymbol[];
export const USER_FACING_TOKEN_SYMBOLS = TOKEN_SYMBOLS;

/**
 * Phase 3 / P3-002 — client mirror of server/src/lib/tokens.ts.
 * Keep in sync. Phase 5b: network-driven via VITE_MANTUA_NETWORK
 * (mainnet | testnet, default testnet → Base Sepolia).
 */

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export const NETWORK: "mainnet" | "testnet" =
  import.meta.env.VITE_MANTUA_NETWORK === "mainnet" ? "mainnet" : "testnet";
export const IS_MAINNET = NETWORK === "mainnet";

export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const BASE_CHAIN_ID: number = IS_MAINNET ? BASE_MAINNET_CHAIN_ID : BASE_SEPOLIA_CHAIN_ID;

/** BaseScan base URL + tx prefix, derived from active network. Centralizes the
 *  5 prior hardcoded `https://basescan.org/tx/` literals across feature files. */
export const BASESCAN_URL = IS_MAINNET ? "https://basescan.org" : "https://sepolia.basescan.org";
export const BASESCAN_TX = `${BASESCAN_URL}/tx/`;

export interface Token {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  coingeckoId: string;
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

export type TokenSymbol = keyof typeof TOKENS_MAINNET | keyof typeof TOKENS_SEPOLIA;
export const TOKEN_SYMBOLS = Object.keys(TOKENS) as TokenSymbol[];

/**
 * User-facing list — what shows in the swap / liquidity selectors.
 * WETH is intentionally excluded because the user-facing convention
 * is to show ETH and let the contract layer wrap on demand. Keep
 * `TOKEN_SYMBOLS` for routing-internal lookups.
 */
export const USER_FACING_TOKEN_SYMBOLS = TOKEN_SYMBOLS.filter(
  (s): s is TokenSymbol => s !== "WETH",
);

export function getToken(symbol: string): Token {
  if (!isTokenSymbol(symbol)) throw new Error(`Unknown token on this network: ${symbol}`);
  return TOKENS[symbol];
}

export function isTokenSymbol(s: string): s is TokenSymbol {
  return Object.prototype.hasOwnProperty.call(TOKENS, s);
}

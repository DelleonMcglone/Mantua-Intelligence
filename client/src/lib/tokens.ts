/**
 * Phase 3 / P3-002 — client mirror of server/src/lib/tokens.ts.
 * Keep in sync. Both files describe the same Base Mainnet token set.
 */

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
export const BASE_CHAIN_ID = 8453;

export interface Token {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  coingeckoId: string;
  native: boolean;
  chainId: number;
}

export const TOKENS = {
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
  LINK: {
    symbol: "LINK",
    name: "Chainlink",
    address: "0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196",
    decimals: 18,
    coingeckoId: "chainlink",
    native: false,
    chainId: BASE_CHAIN_ID,
  },
} as const satisfies Record<string, Token>;

export type TokenSymbol = keyof typeof TOKENS;
export const TOKEN_SYMBOLS = Object.keys(TOKENS) as TokenSymbol[];

export function getToken(symbol: string): Token {
  if (!isTokenSymbol(symbol)) throw new Error(`Unknown token: ${symbol}`);
  return TOKENS[symbol];
}

export function isTokenSymbol(s: string): s is TokenSymbol {
  return Object.prototype.hasOwnProperty.call(TOKENS, s);
}

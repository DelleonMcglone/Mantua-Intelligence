import { base, baseSepolia } from "viem/chains";
import { BASE_CHAIN_ID, IS_MAINNET } from "./tokens.ts";

/**
 * The active viem `Chain` for the configured network. Use this everywhere
 * a wallet/public client needs a chain — never hard-code `base` because
 * the testnet build (`VITE_MANTUA_NETWORK=testnet`, default) targets Base
 * Sepolia and a mainnet chain on a Sepolia wallet would misroute calldata
 * and break the chainId checks that wallet providers do before signing.
 */
export const ACTIVE_CHAIN = IS_MAINNET ? base : baseSepolia;

export const ACTIVE_CHAIN_ID: number = BASE_CHAIN_ID;

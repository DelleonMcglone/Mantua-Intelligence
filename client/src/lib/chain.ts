import { arcTestnet } from "viem/chains";
import { ARC_TESTNET_CHAIN_ID } from "./chains.ts";

/**
 * The active viem `Chain`. Mantua runs on Arc Testnet only — use this
 * everywhere a wallet/public client needs a chain so the chainId checks
 * wallet providers run before signing line up.
 */
export const ACTIVE_CHAIN = arcTestnet;

export const ACTIVE_CHAIN_ID: number = ARC_TESTNET_CHAIN_ID;

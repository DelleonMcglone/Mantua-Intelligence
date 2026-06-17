/**
 * Arc testnet as a custom viem chain — the agent talks to Arc directly over
 * plain viem clients built from this chain definition.
 *
 * nativeCurrency.decimals = 18 because Arc's native gas token (USDC) uses
 * 18 decimals for gas/fee math. This is intentionally NOT the 6-decimal
 * ERC-20 USDC interface — balances/transfers use that separately (see
 * lib/decimals.ts). The RPC URL is injected (loaded from env).
 */
import { defineChain } from "viem";

export const ARC_CHAIN_ID = 5042002 as const;
export const ARC_EXPLORER_URL = "https://testnet.arcscan.app" as const;

export function createArcChain(rpcUrl: string) {
  return defineChain({
    id: ARC_CHAIN_ID,
    name: "Arc Testnet",
    nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: { default: { name: "Arcscan", url: ARC_EXPLORER_URL } },
    testnet: true,
  });
}

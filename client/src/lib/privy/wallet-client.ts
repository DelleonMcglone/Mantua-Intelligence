import { useCallback } from "react";
import { useWallets } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { ACTIVE_CHAIN, ACTIVE_CHAIN_ID } from "../chain.ts";
import { IS_MAINNET } from "../tokens.ts";

const BASE_RPC_FALLBACK = IS_MAINNET ? "https://mainnet.base.org" : "https://sepolia.base.org";

/**
 * Public viem client for read-only chain calls on the active network
 * (Base Mainnet or Base Sepolia, driven by VITE_MANTUA_NETWORK). Swap to
 * a private RPC (Alchemy, QuickNode) via VITE_BASE_RPC_URL.
 *
 * Bug fix: explicit `PublicClient` / `WalletClient` type annotations clash
 * with Privy's bundled (porto-vendored) viem under
 * `exactOptionalPropertyTypes: true`. Annotations removed; types are
 * inferred. Runtime behavior unchanged.
 */
export const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: http(import.meta.env.VITE_BASE_RPC_URL ?? BASE_RPC_FALLBACK),
});

/**
 * P2-013 — bridge from Privy's active wallet to a viem WalletClient.
 * Returns null if no wallet is connected. Caller is responsible for
 * waiting on the Privy `ready` flag before invoking.
 *
 * Chain assertion: throws if the active wallet is on anything other than
 * the active Base network (mainnet or sepolia). The provider attempts an
 * automatic switch first.
 */
export function useBaseWalletClient() {
  const { wallets } = useWallets();

  return useCallback(async () => {
    const active = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
    if (!active) return null;

    if (active.chainId && active.chainId !== `eip155:${String(ACTIVE_CHAIN_ID)}`) {
      try {
        await active.switchChain(ACTIVE_CHAIN_ID);
      } catch {
        throw new Error(
          `Wallet is on ${active.chainId}; Mantua only supports ${ACTIVE_CHAIN.name} (eip155:${String(ACTIVE_CHAIN_ID)}).`,
        );
      }
    }

    const provider = await active.getEthereumProvider();
    return createWalletClient({
      account: active.address as `0x${string}`,
      chain: ACTIVE_CHAIN,
      transport: custom(provider),
    });
  }, [wallets]);
}

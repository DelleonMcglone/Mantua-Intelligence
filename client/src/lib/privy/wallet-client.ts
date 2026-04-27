import { useCallback } from "react";
import { useWallets } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { base } from "viem/chains";

const BASE_CHAIN_ID = 8453;
const BASE_RPC_FALLBACK = "https://mainnet.base.org";

/**
 * Public viem client for read-only chain calls. Uses the public Base RPC by
 * default; swap to a private RPC (Alchemy, QuickNode) by setting
 * VITE_BASE_RPC_URL in client/.env.local.
 *
 * Bug fix: explicit `PublicClient` / `WalletClient` type annotations clash
 * with Privy's bundled (porto-vendored) viem under
 * `exactOptionalPropertyTypes: true`. Annotations removed; types are
 * inferred. Runtime behavior unchanged.
 */
export const publicClient = createPublicClient({
  chain: base,
  transport: http(import.meta.env.VITE_BASE_RPC_URL ?? BASE_RPC_FALLBACK),
});

/**
 * P2-013 — bridge from Privy's active wallet to a viem WalletClient.
 * Returns null if no wallet is connected. Caller is responsible for
 * waiting on the Privy `ready` flag before invoking.
 *
 * Chain assertion: throws if the active wallet is on anything other than
 * Base Mainnet (8453). The provider attempts an automatic switch first.
 */
export function useBaseWalletClient() {
  const { wallets } = useWallets();

  return useCallback(async () => {
    const active = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
    if (!active) return null;

    if (active.chainId && active.chainId !== `eip155:${BASE_CHAIN_ID}`) {
      try {
        await active.switchChain(BASE_CHAIN_ID);
      } catch {
        throw new Error(
          `Wallet is on ${active.chainId}; Mantua only supports Base Mainnet (eip155:${BASE_CHAIN_ID}).`,
        );
      }
    }

    const provider = await active.getEthereumProvider();
    return createWalletClient({
      account: active.address as `0x${string}`,
      chain: base,
      transport: custom(provider),
    });
  }, [wallets]);
}

import { useCallback } from "react";
import { useWallets } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { ACTIVE_CHAIN, ACTIVE_CHAIN_ID } from "../chain.ts";
import { ARC_TESTNET_CHAIN_ID, getRpcUrl } from "../chains.ts";

/**
 * Public viem client for read-only chain calls on Arc Testnet. Override
 * the default Arc RPC with a private endpoint via VITE_ARC_RPC_URL.
 *
 * Bug fix: explicit `PublicClient` / `WalletClient` type annotations clash
 * with Privy's bundled (porto-vendored) viem under
 * `exactOptionalPropertyTypes: true`. Annotations removed; types are
 * inferred. Runtime behavior unchanged.
 */
export const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: http(getRpcUrl(ARC_TESTNET_CHAIN_ID)),
});

/**
 * P2-013 — bridge from Privy's active wallet to a viem WalletClient.
 * Returns null if no wallet is connected. Caller is responsible for
 * waiting on the Privy `ready` flag before invoking.
 *
 * Chain assertion: throws if the active wallet is on anything other than
 * Arc Testnet. The provider attempts an automatic switch first.
 */
export function useArcWalletClient() {
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

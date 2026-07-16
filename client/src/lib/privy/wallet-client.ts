import { useCallback } from "react";
import { useWallets } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom } from "viem";
import { ACTIVE_CHAIN, ACTIVE_CHAIN_ID } from "../chain.ts";
import { ARC_TESTNET_CHAIN_ID, getRpcTransport } from "../chains.ts";

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
  transport: getRpcTransport(ARC_TESTNET_CHAIN_ID),
});

interface Eip1193RequestArgs {
  method: string;
  params?: unknown;
}
interface RequestableProvider {
  request(args: Eip1193RequestArgs): Promise<unknown>;
}

/**
 * Read-only JSON-RPC methods viem issues while preparing/tracking a write
 * (gas price, estimation, nonce, receipts…). These are safe to serve from
 * any public node, so we route them through the hardened multi-host
 * fallback transport instead of the wallet provider.
 */
const PUBLIC_RPC_METHODS = new Set([
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_estimateGas",
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_call",
  "eth_getBalance",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_getTransactionByHash",
  "eth_getCode",
  "eth_getLogs",
]);

/**
 * Wrap a Privy EIP-1193 provider so read-only RPC (eth_gasPrice /
 * eth_estimateGas / receipts…) goes through the hardened fallback transport
 * (3 Arc hosts, batching, retries) while signing + broadcast stay with the
 * wallet. Privy's provider proxies reads through a single upstream that
 * rate-limits under load ("Custom eth_gasPrice: Request is being rate
 * limited"), which made approve/write flows fail even when the app's own
 * read path was healthy. Use with viem's `custom()` transport, which only
 * needs `request`.
 */
export function hardenProvider(provider: RequestableProvider): RequestableProvider {
  return {
    request: (args: Eip1193RequestArgs) =>
      PUBLIC_RPC_METHODS.has(args.method)
        ? (publicClient.request as (a: Eip1193RequestArgs) => Promise<unknown>)(args)
        : provider.request(args),
  };
}

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
    const active = wallets.find((w) => w.walletClientType === "privy") ?? wallets.at(0);
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
      transport: custom(hardenProvider(provider)),
    });
  }, [wallets]);
}

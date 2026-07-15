import { createPublicClient, fallback, http } from "viem";
import { arcTestnet } from "viem/chains";
import { type SupportedTestnetChainId } from "./chains.ts";
import { env } from "../env.ts";

/**
 * Arc Testnet exposes three public RPC hosts. The primary one rate-limits
 * aggressively ("request limit reached" / 429) once the app's polling +
 * quoting traffic concentrates on it, which surfaced as failed swap quotes
 * and missing balances. Spread the load and degrade gracefully:
 *
 *  - `fallback()` rotates to the next host when one errors or rate-limits.
 *  - `http(..., { batch: true })` coalesces concurrent JSON-RPC calls into a
 *    single HTTP request (rate limits count requests, not calls).
 *  - `batch: { multicall: true }` aggregates concurrent `readContract`s into
 *    one Multicall3 `aggregate3` eth_call (deployed on Arc at the canonical
 *    address; declared in viem's arcTestnet chain def).
 *
 * A custom `ARC_RPC_URL` (e.g. a private endpoint) goes first in the list.
 */
const PUBLIC_ARC_RPC_URLS = [
  "https://rpc.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network",
] as const;

const rpcUrls = [env.ARC_RPC_URL, ...PUBLIC_ARC_RPC_URLS.filter((u) => u !== env.ARC_RPC_URL)];

// Types are inferred (not annotated `: PublicClient`): viem's generic
// PublicClient default params don't unify with createPublicClient's
// chain-specialized return, which TS reports as a spurious duplicate-type
// conflict. The inferred type is a PublicClient and works for all callers.
const arcClient = createPublicClient({
  chain: arcTestnet,
  batch: { multicall: { wait: 16 } },
  transport: fallback(
    rpcUrls.map((url) => http(url, { batch: true, retryCount: 1, retryDelay: 300 })),
  ),
});

/**
 * Default single-chain RPC client. Mantua runs on Arc Testnet only, so
 * every read targets Arc. The `baseRpcClient` name is retained as a
 * legacy alias for the many call sites that import it; it now points at
 * the Arc client. Prefer `getRpcClient(chainId)` in new code.
 */
export const baseRpcClient = arcClient;

export function getRpcClient(_chainId: SupportedTestnetChainId) {
  // Arc is the only supported chain; the param is kept for call-site
  // compatibility and future multi-chain reintroduction.
  return arcClient;
}

import { createPublicClient, fallback, http } from "viem";
import { arcTestnet, baseSepolia } from "viem/chains";
import { BASE_SEPOLIA_CHAIN_ID, type SupportedTestnetChainId } from "./chains.ts";
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

const baseSepoliaClient = createPublicClient({
  chain: baseSepolia,
  batch: { multicall: { wait: 16 } },
  transport: fallback([
    http(env.BASE_SEPOLIA_RPC_URL, { batch: true, retryCount: 1, retryDelay: 300 }),
  ]),
});

/**
 * Legacy **Arc** alias — the name predates the Arc migration and does NOT
 * mean Base. Every import of `baseRpcClient` reads Arc Testnet (sports
 * markets, agent Arc flows). Use `getRpcClient(chainId)` in new code.
 */
export const baseRpcClient = arcClient;

/** Per-chain public client: 84532 → Base Sepolia, 5042002 → Arc. */
export function getRpcClient(chainId: SupportedTestnetChainId) {
  return chainId === BASE_SEPOLIA_CHAIN_ID ? baseSepoliaClient : arcClient;
}

/**
 * True when an error is a transient RPC/transport failure (rate limit,
 * timeout, connection drop) rather than a deterministic contract revert.
 * Callers use this to fail open / retry instead of surfacing the raw RPC
 * error as if it were an on-chain rejection ("Swap rejected by hook: RPC
 * Request failed… request limit reached").
 */
export function isTransientRpcError(err: unknown): boolean {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur instanceof Error && !seen.has(cur)) {
    seen.add(cur);
    if (
      /request limit reached|rate limit|too many requests|429|timed? ?out|ECONNRESET|ECONNREFUSED|fetch failed|socket hang up/i.test(
        cur.message,
      )
    ) {
      return true;
    }
    cur = cur.cause;
  }
  return false;
}

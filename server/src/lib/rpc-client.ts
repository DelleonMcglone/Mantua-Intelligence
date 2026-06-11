import { createPublicClient, http } from "viem";
import { arcTestnet } from "viem/chains";
import { type SupportedTestnetChainId } from "./chains.ts";
import { env } from "../env.ts";

// Types are inferred (not annotated `: PublicClient`): viem's generic
// PublicClient default params don't unify with createPublicClient's
// chain-specialized return, which TS reports as a spurious duplicate-type
// conflict. The inferred type is a PublicClient and works for all callers.
const arcClient = createPublicClient({
  chain: arcTestnet,
  transport: http(env.ARC_RPC_URL),
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

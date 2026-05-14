import { DEFAULT_CHAIN_ID, type SupportedTestnetChainId } from "./chains.ts";
import { computePoolId } from "./pool-id.ts";
import type { PoolKey } from "./pool-key.ts";
import { getRpcClient } from "./rpc-client.ts";
import { STATE_VIEW_ABI, getV4StateView } from "./v4-contracts.ts";

export interface Slot0 {
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
}

/**
 * Read a v4 pool's slot0 (live sqrtPriceX96 + tick) via the StateView
 * lens contract on the given chain. Returns null if the pool is
 * uninitialized (sqrtPriceX96 === 0n) — callers decide whether that's
 * an error.
 */
export async function readSlot0(
  key: PoolKey,
  chainId: SupportedTestnetChainId = DEFAULT_CHAIN_ID,
): Promise<Slot0 | null> {
  const poolId = computePoolId(key);
  const [sqrtPriceX96, tick, protocolFee, lpFee] = await getRpcClient(chainId).readContract({
    address: getV4StateView(chainId),
    abi: STATE_VIEW_ABI,
    functionName: "getSlot0",
    args: [poolId],
  });
  if (sqrtPriceX96 === 0n) return null;
  return { sqrtPriceX96, tick, protocolFee, lpFee };
}

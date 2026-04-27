import { computePoolId } from "./pool-id.ts";
import type { PoolKey } from "./pool-key.ts";
import { baseRpcClient } from "./rpc-client.ts";
import { STATE_VIEW_ABI, V4_STATE_VIEW } from "./v4-contracts.ts";

export interface Slot0 {
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
}

/**
 * Read a v4 pool's slot0 (live sqrtPriceX96 + tick) via the StateView
 * lens contract. Returns null if the pool is uninitialized
 * (sqrtPriceX96 === 0n) — callers decide whether that's an error.
 */
export async function readSlot0(key: PoolKey): Promise<Slot0 | null> {
  const poolId = computePoolId(key);
  const [sqrtPriceX96, tick, protocolFee, lpFee] = await baseRpcClient.readContract({
    address: V4_STATE_VIEW,
    abi: STATE_VIEW_ABI,
    functionName: "getSlot0",
    args: [poolId],
  });
  if (sqrtPriceX96 === 0n) return null;
  return { sqrtPriceX96, tick, protocolFee, lpFee };
}

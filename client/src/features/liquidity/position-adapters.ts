import { TOKENS, ZERO_ADDRESS } from "@/lib/tokens.ts";
import { HOOK_ADDRESS } from "./hook-recommendations.ts";
import type { LocalPosition } from "./local-positions.ts";
import type { Position } from "./positions-types.ts";

/**
 * Adapt a `LocalPosition` — whether a localStorage breadcrumb or a row
 * discovered on-chain via `/api/positions/onchain` — into the `Position`
 * shape the Remove flow and position lists consume.
 *
 * Carries `id: ""` so the remove path routes by `tokenId` (these positions
 * have no server-side DB row), and resolves the correct per-hook
 * PositionManager from `hookAddress`. Tick / liquidity fields are
 * placeholders — the server reads the authoritative on-chain values from
 * the tokenId at remove time.
 */
export function localPositionToPosition(lp: LocalPosition): Position {
  return {
    id: "",
    tokenId: lp.tokenId,
    tickLower: 0,
    tickUpper: 0,
    liquidity: "0",
    status: "open",
    openedTx: lp.txHash || null,
    closedTx: null,
    createdAt: new Date(lp.createdAt).toISOString(),
    poolKeyHash: "",
    token0: TOKENS[lp.tokenA].address.toLowerCase(),
    token1: TOKENS[lp.tokenB].address.toLowerCase(),
    fee: lp.fee,
    tickSpacing: 0,
    hookAddress: lp.hook ? HOOK_ADDRESS[lp.hook] : ZERO_ADDRESS,
  };
}

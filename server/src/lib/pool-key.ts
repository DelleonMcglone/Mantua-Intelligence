import { getToken, ZERO_ADDRESS, type TokenSymbol } from "./tokens.ts";
import { TICK_SPACING_BY_FEE, type FeeTier } from "./v4-contracts.ts";

/**
 * v4 PoolKey — addresses must be sorted ascending. Native currency
 * (ETH) is encoded as the zero address.
 */
export interface PoolKey {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
}

const NO_HOOK = ZERO_ADDRESS;

/**
 * Build a v4 PoolKey from token symbols + fee tier. Sorts the two
 * tokens ascending (currency0 < currency1) per v4 invariant. Native
 * ETH (zero address) sorts before any ERC-20.
 */
export function buildPoolKey(
  symA: TokenSymbol,
  symB: TokenSymbol,
  fee: FeeTier,
  hook: `0x${string}` = NO_HOOK,
): { key: PoolKey; flipped: boolean } {
  if (symA === symB) throw new Error("Cannot create a pool with identical tokens");
  const a = getToken(symA);
  const b = getToken(symB);
  const addrA = (a.native ? ZERO_ADDRESS : a.address).toLowerCase() as `0x${string}`;
  const addrB = (b.native ? ZERO_ADDRESS : b.address).toLowerCase() as `0x${string}`;
  const flipped = addrA > addrB;
  const [currency0, currency1] = flipped ? [addrB, addrA] : [addrA, addrB];
  return {
    flipped,
    key: {
      currency0,
      currency1,
      fee,
      tickSpacing: TICK_SPACING_BY_FEE[fee],
      hooks: hook,
    },
  };
}

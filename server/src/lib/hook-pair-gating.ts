/**
 * Phase 5 P5-002 — hook ↔ token-pair allowlist.
 *
 * Originally, Stable Protection's peg-zone logic only behaved correctly
 * on pegged-asset pairs (stable/stable, stable/euro), so pool creation
 * gated on an explicit allowlist. For the proof-of-concept build, the
 * allowlist is empty — every hook accepts every pair, and the hook
 * contract itself is the single source of truth on what it'll do at
 * `beforeInitialize` / `beforeSwap` etc. If the hook reverts, the
 * existing `POOL_CREATE_INVALID` / wallet error path still surfaces it.
 *
 * Hooks not present in HOOK_ALLOWED_SYMBOL_PAIRS (i.e. every hook
 * today) impose no pair restriction at this layer.
 */

import { TOKENS, ZERO_ADDRESS, type TokenSymbol } from "./tokens.ts";
import { getHookAddress, type HookName } from "./v4-contracts.ts";

type SymbolPair = readonly [TokenSymbol, TokenSymbol];

const HOOK_ALLOWED_SYMBOL_PAIRS: Partial<Record<HookName, ReadonlyArray<SymbolPair>>> = {};

function lookupSymbol(addr: string): TokenSymbol | null {
  const lower = addr.toLowerCase();
  for (const symbol of Object.keys(TOKENS) as TokenSymbol[]) {
    if (TOKENS[symbol].address.toLowerCase() === lower) return symbol;
  }
  return null;
}

function pairsMatch(a: SymbolPair, b: SymbolPair): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

/**
 * `null` → no restriction (any pair allowed).
 * `[]`  → hook has zero allowed pairs on the active network.
 */
export function listAllowedPairs(hook: HookName): ReadonlyArray<SymbolPair> | null {
  return HOOK_ALLOWED_SYMBOL_PAIRS[hook] ?? null;
}

export function isHookPairAllowed(
  hook: HookName,
  token0Address: string,
  token1Address: string,
): boolean {
  const allow = HOOK_ALLOWED_SYMBOL_PAIRS[hook];
  if (!allow) return true;
  const sym0 = lookupSymbol(token0Address);
  const sym1 = lookupSymbol(token1Address);
  if (!sym0 || !sym1) return false;
  return allow.some((p) => pairsMatch(p, [sym0, sym1]));
}

export class HookPairNotAllowedError extends Error {
  constructor(
    public readonly hook: HookName,
    public readonly token0Address: string,
    public readonly token1Address: string,
  ) {
    super(
      `Hook "${hook}" does not allow pair ${token0Address}/${token1Address} on the active network`,
    );
    this.name = "HookPairNotAllowedError";
  }
}

export function assertHookPairAllowed(
  hook: HookName,
  token0Address: string,
  token1Address: string,
): void {
  if (!isHookPairAllowed(hook, token0Address, token1Address)) {
    throw new HookPairNotAllowedError(hook, token0Address, token1Address);
  }
}

/**
 * Resolve a hook name to its on-chain address on the active network and
 * gate the pair-against-hook combination. Returns `ZERO_ADDRESS` for a
 * no-hook pool. Throws when the hook is unavailable on this network or
 * the pair is disallowed for the hook.
 */
export function resolveHookForPool(
  hook: HookName | null | undefined,
  token0Address: string,
  token1Address: string,
): `0x${string}` {
  if (!hook) return ZERO_ADDRESS;
  const addr = getHookAddress(hook);
  if (!addr) {
    throw new Error(`Hook "${hook}" is not deployed on the active network`);
  }
  assertHookPairAllowed(hook, token0Address, token1Address);
  return addr;
}

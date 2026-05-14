/**
 * Hook ↔ token-pair allowlist.
 *
 * MVP scope:
 *  - Stable Protection: USDC/EURC only (Base Sepolia). The deployed
 *    hook at `0xe5e6…20C0` hard-codes a 1:1 peg in
 *    `PegMonitor.classifyZone`; USDC and EURC aren't actually 1:1
 *    but the demo treats this pair as the canonical peg-protected
 *    pool. Broaden the allowlist when the hook is upgraded to accept
 *    a `targetRatio`.
 *  - Dynamic Fee: unrestricted — any pair on any supported chain.
 *    Absence from `HOOK_ALLOWED_SYMBOL_PAIRS` below means "no
 *    restriction" (see `listAllowedPairs`).
 */

import { TOKENS, ZERO_ADDRESS, type TokenSymbol } from "./tokens.ts";
import { getHookAddress, type HookName } from "./v4-contracts.ts";

type SymbolPair = readonly [TokenSymbol, TokenSymbol];

const HOOK_ALLOWED_SYMBOL_PAIRS: Partial<Record<HookName, ReadonlyArray<SymbolPair>>> = {
  "stable-protection": [["USDC", "EURC"]],
};

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

/**
 * Reason string surfaced to users when a hook rejects a pair. Hook-
 * specific so the UI can explain *why* (the 1:1 peg assumption for
 * stable-protection, etc.) rather than the bare allow/deny outcome.
 */
function hookIncompatibilityReason(hook: HookName): string {
  switch (hook) {
    case "stable-protection":
      return "Stable Protection is only available on the USDC/EURC pair. Pick that pair or create the pool without a hook.";
    default:
      return `Hook "${hook}" does not support this pair on the active network.`;
  }
}

export class HookPairNotAllowedError extends Error {
  constructor(
    public readonly hook: HookName,
    public readonly token0Address: string,
    public readonly token1Address: string,
  ) {
    super(hookIncompatibilityReason(hook));
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
 * Symbol-based variant of `isHookPairAllowed` for callers that already
 * have the token symbols (e.g. the swap quote path). Avoids the
 * address→symbol lookup step.
 */
export function isHookPairAllowedBySymbol(
  hook: HookName,
  symbolA: TokenSymbol,
  symbolB: TokenSymbol,
): boolean {
  const allow = HOOK_ALLOWED_SYMBOL_PAIRS[hook];
  if (!allow) return true;
  return allow.some((p) => pairsMatch(p, [symbolA, symbolB]));
}

export function assertHookPairAllowedBySymbol(
  hook: HookName,
  symbolA: TokenSymbol,
  symbolB: TokenSymbol,
): void {
  if (!isHookPairAllowedBySymbol(hook, symbolA, symbolB)) {
    throw new HookPairNotAllowedError(
      hook,
      TOKENS[symbolA].address,
      TOKENS[symbolB].address,
    );
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

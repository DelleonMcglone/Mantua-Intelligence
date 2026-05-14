import type { TokenSymbol } from "@/lib/tokens.ts";
import type { HookName } from "./use-create-pool.ts";

export const HOOK_LABELS: Record<HookName, string> = {
  "stable-protection": "Stable Protection",
  "dynamic-fee": "Dynamic Fee",
};

export const HOOK_DESCRIPTIONS: Record<HookName, string> = {
  "stable-protection": "Minimizes depeg & slippage on stable pairs.",
  "dynamic-fee": "Adjusts fees in real time based on volatility.",
};

interface PairRecommendation {
  pair: readonly [TokenSymbol, TokenSymbol];
  hook: HookName;
}

/**
 * Canonical pool/hook pairings. MVP scope:
 *  - USDC/EURC defaults to Stable Protection.
 *  - Every other pair has no default hook; users can still choose
 *    Dynamic Fee (any pair) from the hook dropdown.
 */
export const PAIR_HOOK_RECOMMENDATIONS: readonly PairRecommendation[] = [
  { pair: ["USDC", "EURC"], hook: "stable-protection" },
];

export function recommendedHookForPair(
  a: TokenSymbol,
  b: TokenSymbol,
): HookName | null {
  for (const rec of PAIR_HOOK_RECOMMENDATIONS) {
    const [pa, pb] = rec.pair;
    if ((a === pa && b === pb) || (a === pb && b === pa)) return rec.hook;
  }
  return null;
}

/**
 * Return a user-facing reason string when a hook can't be used with
 * the given pair, or `null` when the combo is fine. Mirror of
 * `server/src/lib/hook-pair-gating.ts` — keep the two in sync. Used
 * by AddLiquidityForm and TestnetSwapPanel to disable submit before
 * hitting the server.
 */
export function hookCompatibilityError(
  a: TokenSymbol,
  b: TokenSymbol,
  hook: HookName | null,
): string | null {
  if (!hook) return null;
  if (hook === "stable-protection") {
    const isUsdcEurc =
      (a === "USDC" && b === "EURC") || (a === "EURC" && b === "USDC");
    if (!isUsdcEurc) {
      return "Stable Protection is only available on the USDC/EURC pair. Pick that pair or create the pool without a hook.";
    }
  }
  return null;
}

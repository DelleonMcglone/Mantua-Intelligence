import type { TokenSymbol } from "@/lib/tokens.ts";
import type { HookName } from "./use-create-pool.ts";

export const HOOK_LABELS: Record<HookName, string> = {
  "stable-protection": "Stable Protection",
  "dynamic-fee": "Dynamic Fee",
  "rwa-gate": "RWA Gate",
  "async-limit-order": "Async Limit Order",
};

export const HOOK_DESCRIPTIONS: Record<HookName, string> = {
  "stable-protection": "Minimizes depeg & slippage on stable pairs.",
  "dynamic-fee": "Adjusts fees in real time based on volatility.",
  "rwa-gate": "Compliance-gated routing for RWA pools.",
  "async-limit-order": "Off-chain matching, on-chain settlement.",
};

interface PairRecommendation {
  pair: readonly [TokenSymbol, TokenSymbol];
  hook: HookName;
}

/**
 * Mantua's canonical testnet pool/hook pairings (per docs/design source).
 * The PoolCreateForm reads this list to auto-suggest the hook when the
 * user picks one of these pairs, and the testnet runbook references the
 * same set so each row in `TESTNET-RUNBOOK.md` matches a real pool.
 *
 * USDC/EURC ↔ stable-protection was dropped: the deployed hook
 * hard-codes a 1:1 peg in PegMonitor and lands every USDC/EURC swap
 * in CRITICAL zone (deviation ≈ 17%+ even at the correct market rate).
 * Re-add when the hook is upgraded to accept a target ratio.
 */
export const PAIR_HOOK_RECOMMENDATIONS: readonly PairRecommendation[] = [
  { pair: ["ETH", "USDC"], hook: "dynamic-fee" },
  { pair: ["USDC", "cbBTC"], hook: "rwa-gate" },
  { pair: ["ETH", "cbBTC"], hook: "async-limit-order" },
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
 * the given pair on the active network, or `null` when the combo is
 * fine. Mirror of `server/src/lib/hook-pair-gating.ts` —
 * keep the two in sync. Used by the AddLiquidityForm and TestnetSwapPanel
 * to disable submit before hitting the server.
 */
export function hookCompatibilityError(
  a: TokenSymbol,
  b: TokenSymbol,
  hook: HookName | null,
): string | null {
  if (!hook) return null;
  if (hook === "stable-protection") {
    // Stable Protection's PegMonitor measures deviation against a
    // hard-coded 1:1 peg. No 1:1-pegged pair exists in the current
    // testnet token set (USDC/USDT, DAI/USDC would qualify), so the
    // hook is unusable here until upgraded or a 1:1 pair is added.
    void a;
    void b;
    return "Stable Protection only supports 1:1-pegged stable pairs (USDC/USDT, DAI/USDC). No such pair is available on Base Sepolia yet — pick a different hook.";
  }
  return null;
}

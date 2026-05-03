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
 */
export const PAIR_HOOK_RECOMMENDATIONS: readonly PairRecommendation[] = [
  { pair: ["USDC", "EURC"], hook: "stable-protection" },
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

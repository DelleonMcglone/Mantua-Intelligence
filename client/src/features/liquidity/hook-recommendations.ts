import type { TokenSymbol } from "@/lib/tokens.ts";
import type { FeeTier } from "./fee-tiers.ts";
import type { HookName } from "./use-create-pool.ts";

export const HOOK_LABELS: Record<HookName, string> = {
  "stable-protection": "Stable Protection",
  "dynamic-fee": "Dynamic Fee",
};

/** Arc Testnet hook addresses (mirror of server v4-contracts). Used to
 *  resolve a local position's hook name → address for the per-hook
 *  PositionManager routing on remove-liquidity. */
export const HOOK_ADDRESS: Record<HookName, `0x${string}`> = {
  "stable-protection": "0xd1Deea248850BFc239Cb282b793b076357Cb20c0",
  "dynamic-fee": "0xA1Be807481F532c074380FCcF05be5e2A3ec80C0",
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
 * Canonical pool/hook pairings (Arc Testnet). Defaults only — users can
 * still pick any hook the pair is allowed for (see `ALLOWED_PAIRS`).
 *  - USDC/EURC defaults to Stable Protection.
 *  - cirBTC pairs default to Dynamic Fee.
 */
export const PAIR_HOOK_RECOMMENDATIONS: readonly PairRecommendation[] = [
  { pair: ["USDC", "EURC"], hook: "stable-protection" },
  { pair: ["USDC", "cirBTC"], hook: "dynamic-fee" },
  { pair: ["EURC", "cirBTC"], hook: "dynamic-fee" },
];

/**
 * Hook → allowed token pairs, mirroring `server/src/lib/hook-pair-gating.ts`
 * `HOOK_ALLOWLIST[ARC_TESTNET_CHAIN_ID]`. Keep the two in exact sync; the
 * server is canonical and re-checks on every calldata request.
 */
const ALLOWED_PAIRS: Record<HookName, readonly (readonly [TokenSymbol, TokenSymbol])[]> = {
  "stable-protection": [["USDC", "EURC"]],
  "dynamic-fee": [
    ["USDC", "cirBTC"],
    ["EURC", "cirBTC"],
  ],
};

function pairMatches(
  a: TokenSymbol,
  b: TokenSymbol,
  [pa, pb]: readonly [TokenSymbol, TokenSymbol],
): boolean {
  return (a === pa && b === pb) || (a === pb && b === pa);
}

export function recommendedHookForPair(a: TokenSymbol, b: TokenSymbol): HookName | null {
  for (const rec of PAIR_HOOK_RECOMMENDATIONS) {
    const [pa, pb] = rec.pair;
    if ((a === pa && b === pb) || (a === pb && b === pa)) return rec.hook;
  }
  return null;
}

/**
 * Canonical fee tier each hook's pools are created/swapped at, mirroring
 * the Add-Liquidity + Swap flows: Stable Protection 0.01%, Dynamic Fee
 * 0.05%, no hook 0.30%. Single source of truth for the hook→fee mapping.
 */
export function feeForHook(hook: HookName | null): FeeTier {
  return hook === "stable-protection" ? 100 : hook === "dynamic-fee" ? 500 : 3000;
}

/**
 * Recover the hook bound to an existing pool from its pair + fee tier.
 * A pair's recommended hook is active only when the pool sits at that
 * hook's canonical fee tier; any other tier (e.g. 0.30%) is a no-hook
 * pool. Returns null for no-hook pools. Inverse of `feeForHook`.
 */
export function hookForPairAndFee(a: TokenSymbol, b: TokenSymbol, fee: FeeTier): HookName | null {
  const rec = recommendedHookForPair(a, b);
  if (!rec) return null;
  return fee === feeForHook(rec) ? rec : null;
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
  const allowed = ALLOWED_PAIRS[hook];
  if (allowed.some((p) => pairMatches(a, b, p))) return null;
  const pairs = allowed.map(([x, y]) => `${x}/${y}`).join(", ");
  return `${HOOK_LABELS[hook]} only supports ${pairs}. Pick a supported pair or create the pool without a hook.`;
}

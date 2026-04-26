/**
 * Mirror of `server/src/lib/v4-contracts.ts` fee-tier constants.
 * Keep in sync.
 */

export const FEE_TIERS = [100, 500, 3000, 10000] as const;
export type FeeTier = (typeof FEE_TIERS)[number];

export const FEE_TIER_LABELS: Record<FeeTier, string> = {
  100: "0.01%",
  500: "0.05%",
  3000: "0.30%",
  10000: "1.00%",
};

export const FEE_TIER_HINTS: Record<FeeTier, string> = {
  100: "Stable pairs",
  500: "ETH / stable",
  3000: "Volatile",
  10000: "Exotic",
};

export const TICK_SPACING_BY_FEE: Record<FeeTier, number> = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
};

export const DEFAULT_FEE_TIER_FOR_PAIR = (
  aIsStable: boolean,
  bIsStable: boolean,
): FeeTier => {
  if (aIsStable && bIsStable) return 100;
  if (aIsStable || bIsStable) return 500;
  return 3000;
};

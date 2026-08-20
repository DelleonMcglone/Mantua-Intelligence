import {
  ARC_TESTNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  type SupportedTestnetChainId,
} from "../../lib/chains.ts";
import type { TokenSymbol } from "@/lib/tokens.ts";
import type { FeeTier } from "./fee-tiers.ts";
import type { HookName } from "./use-create-pool.ts";

export const HOOK_LABELS: Record<HookName, string> = {
  "stable-protection": "Stable Protection",
  "dynamic-fee": "Dynamic Fee",
};

/**
 * Per-chain hook addresses (mirror of server v4-contracts). Used to
 * resolve a local position's hook name → address for the per-hook
 * PositionManager routing on remove-liquidity.
 */
const HOOK_ADDRESS_BY_CHAIN: Record<SupportedTestnetChainId, Record<HookName, `0x${string}`>> = {
  [BASE_SEPOLIA_CHAIN_ID]: {
    "stable-protection": "0xe5e6a9E09Ad1e536788f0c142AD5bc69e8B020C0",
    "dynamic-fee": "0x9788B8495ebcEC1C1D1436681B0F56C6fc0140c0",
  },
  [ARC_TESTNET_CHAIN_ID]: {
    "stable-protection": "0xd1Deea248850BFc239Cb282b793b076357Cb20c0",
    "dynamic-fee": "0xA1Be807481F532c074380FCcF05be5e2A3ec80C0",
  },
};

export function getHookAddress(hook: HookName, chainId: SupportedTestnetChainId): `0x${string}` {
  return HOOK_ADDRESS_BY_CHAIN[chainId][hook];
}

/** LEGACY Arc pin — prefer `getHookAddress(hook, chainId)`. */
export const HOOK_ADDRESS: Record<HookName, `0x${string}`> =
  HOOK_ADDRESS_BY_CHAIN[ARC_TESTNET_CHAIN_ID];

export const HOOK_DESCRIPTIONS: Record<HookName, string> = {
  "stable-protection":
    "FX-aware peg protection — anchors USDC/EURC to the live EUR/USD rate and blocks trades during real depegs.",
  "dynamic-fee": "Per-swap fee scales with live volatility — LPs earn more in turbulence.",
};

interface PairRecommendation {
  pair: readonly [TokenSymbol, TokenSymbol];
  hook: HookName;
}

/**
 * Canonical pool/hook pairings per chain. Defaults only — users can
 * still pick any hook the pair is allowed for (see `ALLOWED_PAIRS`).
 *  - USDC/EURC defaults to Stable Protection on both chains.
 *  - cirBTC pairs default to Dynamic Fee (Arc only — no cirBTC on Base).
 */
const PAIR_HOOK_RECOMMENDATIONS_BY_CHAIN: Record<
  SupportedTestnetChainId,
  readonly PairRecommendation[]
> = {
  [BASE_SEPOLIA_CHAIN_ID]: [{ pair: ["USDC", "EURC"], hook: "stable-protection" }],
  [ARC_TESTNET_CHAIN_ID]: [
    { pair: ["USDC", "EURC"], hook: "stable-protection" },
    { pair: ["USDC", "cirBTC"], hook: "dynamic-fee" },
    { pair: ["EURC", "cirBTC"], hook: "dynamic-fee" },
  ],
};

/**
 * Hook → allowed token pairs per chain, mirroring
 * `server/src/lib/hook-pair-gating.ts` `HOOK_ALLOWLIST`. Keep the two in
 * exact sync; the server is canonical and re-checks on every calldata
 * request. Dynamic Fee on Base Sepolia has zero pairs — its pools there
 * use mock tokens that are not user-facing.
 */
const ALLOWED_PAIRS_BY_CHAIN: Record<
  SupportedTestnetChainId,
  Record<HookName, readonly (readonly [TokenSymbol, TokenSymbol])[]>
> = {
  [BASE_SEPOLIA_CHAIN_ID]: {
    "stable-protection": [["USDC", "EURC"]],
    "dynamic-fee": [],
  },
  [ARC_TESTNET_CHAIN_ID]: {
    "stable-protection": [["USDC", "EURC"]],
    "dynamic-fee": [
      ["USDC", "cirBTC"],
      ["EURC", "cirBTC"],
    ],
  },
};

function pairMatches(
  a: TokenSymbol,
  b: TokenSymbol,
  [pa, pb]: readonly [TokenSymbol, TokenSymbol],
): boolean {
  return (a === pa && b === pb) || (a === pb && b === pa);
}

export function recommendedHookForPair(
  a: TokenSymbol,
  b: TokenSymbol,
  chainId: SupportedTestnetChainId,
): HookName | null {
  for (const rec of PAIR_HOOK_RECOMMENDATIONS_BY_CHAIN[chainId]) {
    if (pairMatches(a, b, rec.pair)) return rec.hook;
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
export function hookForPairAndFee(
  a: TokenSymbol,
  b: TokenSymbol,
  fee: FeeTier,
  chainId: SupportedTestnetChainId,
): HookName | null {
  const rec = recommendedHookForPair(a, b, chainId);
  if (!rec) return null;
  return fee === feeForHook(rec) ? rec : null;
}

/**
 * Return a user-facing reason string when a hook can't be used with
 * the given pair on the given chain, or `null` when the combo is fine.
 * Mirror of `server/src/lib/hook-pair-gating.ts` — keep the two in sync.
 * Used by AddLiquidityForm and TestnetSwapPanel to disable submit before
 * hitting the server.
 */
export function hookCompatibilityError(
  a: TokenSymbol,
  b: TokenSymbol,
  hook: HookName | null,
  chainId: SupportedTestnetChainId,
): string | null {
  if (!hook) return null;
  const allowed = ALLOWED_PAIRS_BY_CHAIN[chainId][hook];
  if (allowed.some((p) => pairMatches(a, b, p))) return null;
  if (allowed.length === 0) {
    return `${HOOK_LABELS[hook]} has no supported pairs on this network yet. Create the pool without a hook.`;
  }
  const pairs = allowed.map(([x, y]) => `${x}/${y}`).join(", ");
  return `${HOOK_LABELS[hook]} only supports ${pairs}. Pick a supported pair or create the pool without a hook.`;
}

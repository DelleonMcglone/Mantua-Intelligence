import type { TokenSymbol } from "@/lib/tokens.ts";
import type { FeeTier } from "./fee-tiers.ts";
import type { HookName } from "./use-create-pool.ts";

const STORAGE_KEY = "mantua.localPools.v1";

export interface LocalPool {
  /** Lowercased composite key — `${tokenA}|${tokenB}|${fee}|${hook ?? "none"}`.
   *  Token order is canonicalized by `localPoolKey` so adding to USDC/EURC
   *  vs EURC/USDC dedupes. */
  key: string;
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  fee: FeeTier;
  hook: HookName | null;
  /** Last on-chain init or add-liquidity tx hash on this pool. */
  txHash: string;
  /** ms epoch of the most recent activity. */
  lastSeenAt: number;
}

/**
 * Stable client-side store for pools the user has touched on testnet.
 * /api/pools short-circuits to `[]` on Sepolia (DefiLlama doesn't
 * index it) and Postgres-backed reads aren't available locally for
 * everyone — but the LP list still needs to feel populated as the
 * user creates pools. localStorage is the cheapest "remember what
 * the user just did" surface for the POC; swap to a server source
 * once that lights up.
 */
export function localPoolKey(
  tokenA: TokenSymbol,
  tokenB: TokenSymbol,
  fee: FeeTier,
  hook: HookName | null,
): string {
  const [a, b] = [tokenA, tokenB].sort();
  return `${a}|${b}|${String(fee)}|${hook ?? "none"}`;
}

export function getLocalPools(): LocalPool[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalPool[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  } catch {
    return [];
  }
}

export function rememberLocalPool(entry: Omit<LocalPool, "key" | "lastSeenAt">) {
  if (typeof window === "undefined") return;
  try {
    const existing = getLocalPools();
    const key = localPoolKey(entry.tokenA, entry.tokenB, entry.fee, entry.hook);
    const next: LocalPool = {
      ...entry,
      key,
      lastSeenAt: Date.now(),
    };
    const others = existing.filter((p) => p.key !== key);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([next, ...others]));
  } catch {
    // localStorage write failures are non-fatal — the user just won't
    // see this pool show up in the list, and on-chain state is the
    // source of truth anyway.
  }
}

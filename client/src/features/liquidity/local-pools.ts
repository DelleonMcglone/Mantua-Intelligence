import {
  ARC_TESTNET_CHAIN_ID,
  isSupportedTestnetChainId,
  type SupportedTestnetChainId,
} from "@/lib/chains.ts";
import type { TokenSymbol } from "@/lib/tokens.ts";
import type { FeeTier } from "./fee-tiers.ts";
import type { HookName } from "./use-create-pool.ts";

const STORAGE_KEY = "mantua.localPools.v2";

export interface LocalPool {
  /** Lowercased composite key — `${chainId}|${tokenA}|${tokenB}|${fee}|${hook ?? "none"}`.
   *  Token order is canonicalized by `localPoolKey`; chainId is part of
   *  the key so the same pair on different chains doesn't collide. */
  key: string;
  /** Chain the pool was created on. Pre-PR-101 entries are read from
   *  the v1 key and migrated lazily by `getLocalPools()`. */
  chainId: SupportedTestnetChainId;
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  fee: FeeTier;
  hook: HookName | null;
  /** Last on-chain init or add-liquidity tx hash on this pool. */
  txHash: string;
  /** ms epoch of the most recent activity. */
  lastSeenAt: number;
}

export function localPoolKey(
  chainId: SupportedTestnetChainId,
  tokenA: TokenSymbol,
  tokenB: TokenSymbol,
  fee: FeeTier,
  hook: HookName | null,
): string {
  const [a, b] = [tokenA, tokenB].sort();
  return `${String(chainId)}|${a}|${b}|${String(fee)}|${hook ?? "none"}`;
}

interface LegacyLocalPool {
  key: string;
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  fee: FeeTier;
  hook: HookName | null;
  txHash: string;
  lastSeenAt: number;
}

/**
 * Read pools, migrating any legacy v1 entries (no chainId) into the v2
 * shape by assigning them to Arc Testnet. v1 storage key is cleared
 * after migration so we don't double-read on next mount.
 */
export function getLocalPools(): LocalPool[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalPool[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((p) => isSupportedTestnetChainId(p.chainId))
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    }
    // v1 fallback — migrate to v2 with chainId = Arc Testnet.
    const legacyRaw = window.localStorage.getItem("mantua.localPools.v1");
    if (!legacyRaw) return [];
    const legacy = JSON.parse(legacyRaw) as LegacyLocalPool[];
    if (!Array.isArray(legacy)) return [];
    const migrated: LocalPool[] = legacy.map((p) => ({
      ...p,
      chainId: ARC_TESTNET_CHAIN_ID,
      key: localPoolKey(ARC_TESTNET_CHAIN_ID, p.tokenA, p.tokenB, p.fee, p.hook),
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  } catch {
    return [];
  }
}

export function rememberLocalPool(entry: Omit<LocalPool, "key" | "lastSeenAt">) {
  if (typeof window === "undefined") return;
  try {
    const existing = getLocalPools();
    const key = localPoolKey(entry.chainId, entry.tokenA, entry.tokenB, entry.fee, entry.hook);
    const next: LocalPool = {
      ...entry,
      key,
      lastSeenAt: Date.now(),
    };
    const others = existing.filter((p) => p.key !== key);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([next, ...others]));
  } catch {
    // localStorage write failures are non-fatal.
  }
}

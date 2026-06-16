import {
  ARC_TESTNET_CHAIN_ID,
  isSupportedTestnetChainId,
  type SupportedTestnetChainId,
} from "@/lib/chains.ts";
import type { TokenSymbol } from "@/lib/tokens.ts";
import type { FeeTier } from "./fee-tiers.ts";
import type { HookName } from "./use-create-pool.ts";

const STORAGE_KEY = "mantua.localPositions.v2";

export type PositionOwner = "user" | "agent";

export interface LocalPosition {
  /** Chain the position was minted on. */
  chainId: SupportedTestnetChainId;
  /** PositionManager ERC721 token id minted at add-liquidity time. */
  tokenId: string;
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  fee: FeeTier;
  hook: HookName | null;
  amountA: string;
  amountB: string;
  txHash: string;
  createdAt: number;
  owner?: PositionOwner;
}

interface LegacyLocalPosition {
  tokenId: string;
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  fee: FeeTier;
  hook: HookName | null;
  amountA: string;
  amountB: string;
  txHash: string;
  createdAt: number;
  owner?: PositionOwner;
}

export function getLocalPositions(): LocalPosition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalPosition[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((p) => isSupportedTestnetChainId(p.chainId))
        .sort((a, b) => b.createdAt - a.createdAt);
    }
    // v1 → v2 migration: assign existing positions to Arc Testnet.
    const legacyRaw = window.localStorage.getItem("mantua.localPositions.v1");
    if (!legacyRaw) return [];
    const legacy = JSON.parse(legacyRaw) as LegacyLocalPosition[];
    if (!Array.isArray(legacy)) return [];
    const migrated: LocalPosition[] = legacy.map((p) => ({
      ...p,
      chainId: ARC_TESTNET_CHAIN_ID,
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/** User-owned positions. The Positions tab shows Arc Testnet
 *  entries. */
export function getUserLocalPositions(): LocalPosition[] {
  return getLocalPositions().filter((p) => (p.owner ?? "user") === "user");
}

export function getAgentLocalPositions(): LocalPosition[] {
  return getLocalPositions().filter((p) => p.owner === "agent");
}

export function rememberLocalPosition(entry: Omit<LocalPosition, "createdAt">) {
  if (typeof window === "undefined") return;
  try {
    const existing = getLocalPositions();
    // Dedupe on `(chainId, tokenId)` — tokenIds aren't unique across
    // chains, so the composite key prevents cross-chain collisions.
    const others = existing.filter(
      // The chainId check is defensive for future multi-chain support; today
      // SupportedTestnetChainId is a single literal so TS sees it as constant.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      (p) => !(p.tokenId === entry.tokenId && p.chainId === entry.chainId),
    );
    const next: LocalPosition = { ...entry, createdAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([next, ...others]));
  } catch {
    // localStorage write failures are non-fatal.
  }
}

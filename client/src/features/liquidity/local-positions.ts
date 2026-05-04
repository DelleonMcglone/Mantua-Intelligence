import type { TokenSymbol } from "@/lib/tokens.ts";
import type { FeeTier } from "./fee-tiers.ts";
import type { HookName } from "./use-create-pool.ts";

const STORAGE_KEY = "mantua.localPositions.v1";

export interface LocalPosition {
  /** PositionManager ERC721 token id minted at add-liquidity time. */
  tokenId: string;
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  fee: FeeTier;
  hook: HookName | null;
  /** Initial deposit amounts (display strings, not raw base units). */
  amountA: string;
  amountB: string;
  /** Mint tx hash. */
  txHash: string;
  /** ms epoch — used to sort newest first. */
  createdAt: number;
}

/**
 * Client-side breadcrumb for positions the user has minted on testnet.
 * `/api/positions` is Postgres-backed and the local DB stays offline
 * for everyone — but the Positions tab still needs to feel populated
 * once a mint receipt confirms. localStorage is the cheapest "remember
 * what the user just did" surface for the POC; swap to a server source
 * (Postgres, on-chain enumeration via PositionManager NFT, or a
 * Sepolia subgraph) once one of those lights up.
 *
 * On-chain state is still the source of truth — these entries are just
 * a list of NFT tokenIds the client knows about. If the user's wallet
 * holds the NFT, it's a real position regardless of what's in here.
 */

export function getLocalPositions(): LocalPosition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalPosition[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function rememberLocalPosition(entry: Omit<LocalPosition, "createdAt">) {
  if (typeof window === "undefined") return;
  try {
    const existing = getLocalPositions();
    // Dedupe on tokenId — re-adding to the same NFT updates its
    // amounts/txHash/createdAt rather than producing a duplicate row.
    const others = existing.filter((p) => p.tokenId !== entry.tokenId);
    const next: LocalPosition = { ...entry, createdAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([next, ...others]));
  } catch {
    // localStorage write failures are non-fatal.
  }
}

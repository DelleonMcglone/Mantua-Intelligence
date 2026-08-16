import { keccak256, encodeAbiParameters } from "viem";

/**
 * Market ID scheme — B0-004.
 *
 * A market ID is `keccak256(abi.encode(providerEventId, marketType,
 * outcomeIndex))`, normalised first. It is deterministic and derivable
 * off-chain, which is what makes the market generator (B3-006) safe to
 * re-run: the same game always yields the same ID, so a repeated slate
 * refresh is a no-op rather than a duplicate market.
 *
 * Why `encodeAbiParameters` and not string concatenation: concatenating
 * with a separator invites collisions the moment a provider ID contains
 * the separator. ABI encoding is length-prefixed per field, so
 * ("nfl-1", "2") and ("nfl", "1-2") cannot collide. It also matches what
 * Solidity's `abi.encode` produces, so the contract can recompute and
 * verify the same ID without a second scheme.
 *
 * Spec: `docs/specs/market-id.md`.
 */

/** Market types. Moneyline only at launch per DM-106. */
export const MARKET_TYPES = ["moneyline"] as const;
export type MarketType = (typeof MARKET_TYPES)[number];

export interface MarketIdInput {
  /** Provider's event identifier, e.g. an ESPN game ID. */
  providerEventId: string;
  marketType: MarketType;
  /**
   * Which outcome this market's YES token represents. For a moneyline,
   * 0 = home, 1 = away. Fixed by the canonical event row, never by the
   * order the provider happened to return teams in.
   */
  outcomeIndex: number;
}

/**
 * Normalise before hashing so trivial provider differences — casing,
 * padding — cannot produce two IDs for one game.
 */
function normalizeEventId(providerEventId: string): string {
  return providerEventId.trim().toLowerCase();
}

export class InvalidMarketIdInputError extends Error {}

/** Deterministic 32-byte market ID. */
export function computeMarketId(input: MarketIdInput): `0x${string}` {
  const eventId = normalizeEventId(input.providerEventId);
  if (eventId === "") {
    throw new InvalidMarketIdInputError("providerEventId must not be empty");
  }
  if (!Number.isInteger(input.outcomeIndex) || input.outcomeIndex < 0) {
    throw new InvalidMarketIdInputError(
      `outcomeIndex must be a non-negative integer, got ${String(input.outcomeIndex)}`,
    );
  }
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "string" }, { type: "uint8" }],
      [eventId, input.marketType, input.outcomeIndex],
    ),
  );
}

/**
 * The two market IDs of a binary moneyline — the YES side of each
 * outcome. Home is index 0, away is index 1.
 */
export function moneylineMarketIds(providerEventId: string): {
  home: `0x${string}`;
  away: `0x${string}`;
} {
  return {
    home: computeMarketId({ providerEventId, marketType: "moneyline", outcomeIndex: 0 }),
    away: computeMarketId({ providerEventId, marketType: "moneyline", outcomeIndex: 1 }),
  };
}

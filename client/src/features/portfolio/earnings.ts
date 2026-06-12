/**
 * Earnings tab data — a position's REAL uncollected swap fees, read live from
 * v4 on-chain state (`GET /api/earnings`). No fabricated figures: positions
 * with no accrued fees report 0; the tab shows $0 until liquidity earns fees.
 */

export type EarningsNetwork = "arc";

/** One open position's uncollected fees (mirrors the server payload). */
export interface EarningPosition {
  tokenId: string;
  hookAddress: string | null;
  sym0: string;
  sym1: string;
  /** Raw token units (stringified bigint). */
  accrued0: string;
  accrued1: string;
  /** Human-readable token amounts. */
  accrued0Human: number;
  accrued1Human: number;
  /** Best-effort USD value of the accrued fees. */
  accruedUsd: number;
}

export interface EarningsData {
  totalAccruedUsd: number;
  positions: EarningPosition[];
}

/** Positions currently holding a non-zero accrued fee balance. */
export function earningPoolCount(data: EarningsData | null): number {
  if (!data) return 0;
  return data.positions.filter(
    (p) => p.accruedUsd > 0 || p.accrued0Human > 0 || p.accrued1Human > 0,
  ).length;
}

export function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "$—";
  if (n === 0) return "$0.00";
  if (n > 0 && n < 0.01) return "<$0.01";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compact token amount, e.g. 0.0042 → "0.0042", 1234.5 → "1,234.5". */
export function fmtToken(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  if (n > 0 && n < 0.000001) return "<0.000001";
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function shortenHash(hash: string): string {
  if (hash.length <= 13) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

/**
 * Earnings tab data — the LP's USDC fee-share: a configurable share of
 * swap fees plus agent-rebalancing fees, auto-distributed to the
 * connected wallet. This is protocol revenue, NOT emissions — the yield
 * is always labelled "fee APR", never reward/emission APR.
 *
 * Design-source mock until the fee-distribution backend lights up
 * (mirrors the `POSITIONS` mock convention in `AssetsCard`). Numbers are
 * intentionally modest + testnet-appropriate; pools with negligible
 * volume are flagged `lowVolume` so the UI renders an honest early-state
 * line instead of an inflated APR.
 */

import type { AssetSymbol } from "./asset-icons.tsx";
import type { HookName } from "./hook-tint.ts";

export type EarningsPeriod = "1D" | "TW" | "1M" | "1Y";
export const EARNINGS_PERIODS: EarningsPeriod[] = ["1D", "TW", "1M", "1Y"];

export const PERIOD_LABEL: Record<EarningsPeriod, string> = {
  "1D": "past day",
  TW: "past week",
  "1M": "past month",
  "1Y": "past year",
};

/** Section grouping — same network key as the chain chip. */
export type EarningsNetwork = "arc";

export interface PoolEarning {
  id: string;
  network: EarningsNetwork;
  a: AssetSymbol;
  b: AssetSymbol;
  /** Fee-tier label, e.g. "0.05%". */
  fee: string;
  hook: HookName;
  /** USDC fee-share accrued and pending auto-distribution. */
  accruedUsdc: number;
  /** Annualized fee-APR contribution from this pool. */
  feeAprPct: number;
  /** Accrued split — swap fees vs agent-rebalancing fees (USDC). */
  swapFeesUsdc: number;
  agentFeesUsdc: number;
  /** The LP's configured share of fees vs the protocol's. */
  lpSharePct: number;
  protocolSharePct: number;
  /** Negligible volume → show an honest early-state line, not an APR. */
  lowVolume: boolean;
}

export interface Distribution {
  id: string;
  date: string;
  txHash: string;
  amountUsdc: number;
}

export interface EarningsData {
  /** Fee-share earned, per period, in USDC. */
  earnedByPeriod: Record<EarningsPeriod, number>;
  /** Blended fee APR across actively-earning pools. */
  feeAprPct: number;
  pools: PoolEarning[];
  distributions: Distribution[];
  /** Auto-distribution destination (the connected wallet). */
  destinationWallet: string;
  networkName: string;
  /** Estimated gas for a manual sweep. */
  estGas: string;
}

/** Earning pools = pools currently producing a meaningful fee-share. */
export function earningPoolCount(data: EarningsData | null): number {
  if (!data) return 0;
  return data.pools.filter((p) => !p.lowVolume).length;
}

export function totalAccruedUsdc(data: EarningsData | null): number {
  if (!data) return 0;
  return data.pools.reduce((sum, p) => sum + p.accruedUsdc, 0);
}

export function getEarnings(
  walletAddress: string | null,
  networkName: string,
): EarningsData | null {
  if (!walletAddress) return null;
  const pools: PoolEarning[] = [
    {
      id: "base-usdc-eurc-001",
      network: "arc",
      a: "USDC",
      b: "EURC",
      fee: "0.01%",
      hook: "Stable Protection",
      accruedUsdc: 9.2143,
      feeAprPct: 11.4,
      swapFeesUsdc: 7.11,
      agentFeesUsdc: 2.1,
      lpSharePct: 80,
      protocolSharePct: 20,
      lowVolume: false,
    },
    {
      id: "arc-usdc-cirbtc-005",
      network: "arc",
      a: "USDC",
      b: "cirBTC",
      fee: "0.05%",
      hook: "Dynamic Fee",
      accruedUsdc: 4.8067,
      feeAprPct: 6.3,
      swapFeesUsdc: 3.92,
      agentFeesUsdc: 0.89,
      lpSharePct: 75,
      protocolSharePct: 25,
      lowVolume: false,
    },
    {
      id: "arc-eurc-cirbtc-030",
      network: "arc",
      a: "EURC",
      b: "cirBTC",
      fee: "0.30%",
      hook: "Dynamic Fee",
      accruedUsdc: 0.0142,
      feeAprPct: 0,
      swapFeesUsdc: 0.0142,
      agentFeesUsdc: 0,
      lpSharePct: 75,
      protocolSharePct: 25,
      lowVolume: true,
    },
    {
      id: "arc-usdc-eurc-001",
      network: "arc",
      a: "USDC",
      b: "EURC",
      fee: "0.01%",
      hook: "Stable Protection",
      accruedUsdc: 0,
      feeAprPct: 0,
      swapFeesUsdc: 0,
      agentFeesUsdc: 0,
      lpSharePct: 80,
      protocolSharePct: 20,
      lowVolume: true,
    },
  ];
  return {
    earnedByPeriod: { "1D": 2.1403, TW: 14.8021, "1M": 58.904, "1Y": 612.39 },
    feeAprPct: 8.2,
    pools,
    distributions: [
      {
        id: "d1",
        date: "Jun 6, 2026",
        txHash: "0x9f2ad4c1b8e07a3f6c2190d4b7e85a1f0c3d62c4",
        amountUsdc: 12.84,
      },
      {
        id: "d2",
        date: "May 30, 2026",
        txHash: "0x3b71e0a92f14c8d6053ab7290fe1c4d8a6b09e37",
        amountUsdc: 11.07,
      },
      {
        id: "d3",
        date: "May 23, 2026",
        txHash: "0xa15e7f3b2c9d4081e6a35f70b9c2d1487fae0c5b",
        amountUsdc: 9.63,
      },
    ],
    destinationWallet: walletAddress,
    networkName,
    estGas: "~0.00002 ETH ($0.05)",
  };
}

export function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "$—";
  if (n === 0) return "$0.00";
  if (n > 0 && n < 0.01) return "<$0.01";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function shortenHash(hash: string): string {
  if (hash.length <= 13) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

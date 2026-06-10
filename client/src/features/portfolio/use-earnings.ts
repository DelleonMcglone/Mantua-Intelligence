import { useMemo } from "react";
import { useCurrentChainId } from "@/lib/chain-context.tsx";
import { CHAIN_INFO } from "@/lib/chains.ts";
import { getEarnings, type EarningsData } from "./earnings.ts";

/**
 * Resolve the connected wallet's fee-share earnings for the current
 * chain. Returns null until a wallet is connected. Memoized on the
 * wallet + network so the Earnings tab and its count badge derive from
 * a single computation.
 */
export function useEarnings(walletAddress: string | null): EarningsData | null {
  const chainId = useCurrentChainId();
  const networkName = CHAIN_INFO[chainId].displayName;
  return useMemo(() => getEarnings(walletAddress, networkName), [walletAddress, networkName]);
}

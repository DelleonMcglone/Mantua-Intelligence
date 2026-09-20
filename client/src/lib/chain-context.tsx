/* eslint-disable react-refresh/only-export-components -- context module: Provider component + useCurrentChainId hook live together. */
import { createContext, useContext, useEffect, useMemo } from "react";
import { useWallets } from "@privy-io/react-auth";
import { DEFAULT_CHAIN_ID, type SupportedTestnetChainId } from "./chains.ts";

interface ChainContextValue {
  /** The chain every read and write in the app runs against. */
  chainId: SupportedTestnetChainId;
}

const ChainContext = createContext<ChainContextValue | null>(null);

/** Key written by the old chain selector. Cleared on mount — see below. */
const LEGACY_STORAGE_KEY = "mantua.selectedChainId";

/**
 * Provider for the active chain.
 *
 * The app runs on one chain and does not say which (task 001): the network
 * selector is gone, so there is nothing for a user to pick and nothing for
 * the wallet to mirror back. `DEFAULT_CHAIN_ID` is the whole story, and the
 * connected wallet is switched onto it rather than the other way round.
 *
 * A build before this one let the user select a second chain and persisted
 * the choice. That key is deleted on mount, so a returning visitor is not
 * stranded on a chain nothing in the UI can switch away from.
 */
export function ChainProvider({ children }: { children: React.ReactNode }) {
  const { wallets } = useWallets();

  // Pick the wallet the user is connected through. Privy's first entry
  // is the primary; same convention used elsewhere in the codebase.
  const wallet = useMemo(() => {
    return wallets.find((w) => w.walletClientType === "privy") ?? wallets.at(0);
  }, [wallets]);

  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Storage unavailable (private mode etc.) — nothing to clean up.
    }
  }, []);

  // Keep the connected wallet on the app's chain. A wallet sitting on
  // anything else would have every write rejected, so this is a sync to an
  // external system, not derived state.
  useEffect(() => {
    if (!wallet?.chainId) return;
    if (wallet.chainId === `eip155:${String(DEFAULT_CHAIN_ID)}`) return;
    void wallet.switchChain(DEFAULT_CHAIN_ID).catch(() => {
      // User rejected, or the wallet doesn't support the chain. The wallet
      // surfaces its own error; the app stays on DEFAULT_CHAIN_ID and the
      // write that needs it will prompt again.
    });
  }, [wallet]);

  const value = useMemo<ChainContextValue>(() => ({ chainId: DEFAULT_CHAIN_ID }), []);

  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
}

export function useCurrentChainId(): SupportedTestnetChainId {
  const ctx = useContext(ChainContext);
  // Sensible fallback outside the provider — keeps tests happy and means
  // non-provider code paths get the same single chain.
  return ctx?.chainId ?? DEFAULT_CHAIN_ID;
}

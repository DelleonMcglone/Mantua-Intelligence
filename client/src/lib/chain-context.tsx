import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import {
  BASE_SEPOLIA_CHAIN_ID,
  isSupportedTestnetChainId,
  type SupportedTestnetChainId,
} from "./chains.ts";

interface ChainContextValue {
  /** Currently selected chain for all reads/writes. Mirrors the
   *  connected wallet's chainId when the wallet is in sync. */
  chainId: SupportedTestnetChainId;
  /** User-driven selection. Calls `wallet.switchChain()` against the
   *  primary embedded/connected wallet and updates the context. */
  setChainId: (id: SupportedTestnetChainId) => Promise<void>;
  /** True while a `wallet.switchChain` call is in flight (user
   *  approval dialog open in their wallet). */
  switching: boolean;
}

const ChainContext = createContext<ChainContextValue | null>(null);

const STORAGE_KEY = "mantua.selectedChainId";

function readStoredChainId(): SupportedTestnetChainId {
  if (typeof window === "undefined") return BASE_SEPOLIA_CHAIN_ID;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return BASE_SEPOLIA_CHAIN_ID;
    const n = Number(raw);
    if (isSupportedTestnetChainId(n)) return n;
    return BASE_SEPOLIA_CHAIN_ID;
  } catch {
    return BASE_SEPOLIA_CHAIN_ID;
  }
}

/**
 * Provider for the current chain selection. Drives:
 *   - The chain selector chip in `InputBar`.
 *   - Per-chain token list in `AssetsCard`.
 *   - chainId param sent on pool-create / add-liquidity / swap requests.
 *
 * Wallet chain sync: when the connected wallet's `chainId` changes
 * (user switches in their wallet UI), the context tracks it. When the
 * user picks a chain in our selector, the context calls
 * `wallet.switchChain` first — if that succeeds the context updates;
 * on rejection we keep the previous chainId.
 */
export function ChainProvider({ children }: { children: React.ReactNode }) {
  const { wallets } = useWallets();
  const [chainId, setChainIdState] = useState<SupportedTestnetChainId>(() =>
    readStoredChainId(),
  );
  const [switching, setSwitching] = useState(false);

  // Pick the wallet the user is connected through. Privy's first entry
  // is the primary; same convention used elsewhere in the codebase.
  const wallet = useMemo(() => {
    return wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  }, [wallets]);

  // Pull initial chainId from the wallet on first mount so the
  // selector shows the wallet's actual chain (not just our persisted
  // pick). If the wallet is on an unsupported chain, fall back to the
  // stored pick.
  useEffect(() => {
    if (!wallet?.chainId) return;
    const eip = wallet.chainId.startsWith("eip155:")
      ? Number(wallet.chainId.slice("eip155:".length))
      : Number(wallet.chainId);
    if (isSupportedTestnetChainId(eip)) {
      setChainIdState(eip);
    }
  }, [wallet?.chainId]);

  const setChainId = useCallback(
    async (next: SupportedTestnetChainId) => {
      if (next === chainId) return;
      if (!wallet) {
        // No wallet yet — just remember the selection; we'll switch
        // once the user connects.
        setChainIdState(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, String(next));
        } catch {
          // localStorage failures (quota, private mode) are non-fatal —
          // the selection still drives the in-memory context.
        }
        return;
      }
      setSwitching(true);
      try {
        await wallet.switchChain(next);
        setChainIdState(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, String(next));
        } catch {
          // localStorage failures (quota, private mode) are non-fatal —
          // the selection still drives the in-memory context.
        }
      } catch (err) {
        // User rejected or wallet doesn't support the chain — leave
        // selection unchanged. Wallet surfaces its own error toast.
        void err;
      } finally {
        setSwitching(false);
      }
    },
    [chainId, wallet],
  );

  const value = useMemo<ChainContextValue>(
    () => ({ chainId, setChainId, switching }),
    [chainId, setChainId, switching],
  );

  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
}

export function useCurrentChainId(): SupportedTestnetChainId {
  const ctx = useContext(ChainContext);
  if (!ctx) {
    // Sensible fallback outside the provider — keeps tests + storybook
    // happy and means non-multichain code paths default to Base Sepolia.
    return BASE_SEPOLIA_CHAIN_ID;
  }
  return ctx.chainId;
}

export function useChainSelector(): ChainContextValue {
  const ctx = useContext(ChainContext);
  if (!ctx) {
    throw new Error("useChainSelector must be used inside <ChainProvider>");
  }
  return ctx;
}

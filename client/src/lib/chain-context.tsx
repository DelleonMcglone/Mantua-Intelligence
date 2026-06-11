import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import {
  ARC_TESTNET_CHAIN_ID,
  isSupportedTestnetChainId,
  type SupportedTestnetChainId,
} from "./chains.ts";

interface ChainContextValue {
  /** Currently active chain for all reads/writes. Mantua is Arc-only, so
   *  this is always Arc Testnet; it still mirrors the connected wallet's
   *  chainId so consumers can detect a wallet that's on the wrong chain. */
  chainId: SupportedTestnetChainId;
  /** Switch the connected wallet to a supported chain (Arc). Kept for
   *  flows that nudge a mis-configured wallet back onto Arc. */
  setChainId: (id: SupportedTestnetChainId) => Promise<void>;
  /** True while a `wallet.switchChain` call is in flight (user
   *  approval dialog open in their wallet). */
  switching: boolean;
}

const ChainContext = createContext<ChainContextValue | null>(null);

const STORAGE_KEY = "mantua.selectedChainId";

function readStoredChainId(): SupportedTestnetChainId {
  if (typeof window === "undefined") return ARC_TESTNET_CHAIN_ID;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return ARC_TESTNET_CHAIN_ID;
    const n = Number(raw);
    if (isSupportedTestnetChainId(n)) return n;
    return ARC_TESTNET_CHAIN_ID;
  } catch {
    return ARC_TESTNET_CHAIN_ID;
  }
}

/**
 * Provider for the active chain. Mantua runs on Arc Testnet only, so
 * `chainId` is effectively constant; the provider still tracks the
 * connected wallet's chainId so flows can switch a mis-configured
 * wallet back onto Arc. Drives the per-chain token list and the
 * chainId param sent on pool-create / add-liquidity / swap requests.
 */
export function ChainProvider({ children }: { children: React.ReactNode }) {
  const { wallets } = useWallets();
  const [chainId, setChainIdState] = useState<SupportedTestnetChainId>(() => readStoredChainId());
  const [switching, setSwitching] = useState(false);

  // Pick the wallet the user is connected through. Privy's first entry
  // is the primary; same convention used elsewhere in the codebase.
  const wallet = useMemo(() => {
    return wallets.find((w) => w.walletClientType === "privy") ?? wallets.at(0);
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
      // Mirroring the wallet's externally-controlled chain into React
      // state is exactly the external-system sync an effect is for.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // happy and means non-provider code paths default to Arc Testnet.
    return ARC_TESTNET_CHAIN_ID;
  }
  return ctx.chainId;
}

export function useChainSwitch(): ChainContextValue {
  const ctx = useContext(ChainContext);
  if (!ctx) {
    throw new Error("useChainSwitch must be used inside <ChainProvider>");
  }
  return ctx;
}

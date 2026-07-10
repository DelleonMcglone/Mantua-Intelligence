import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { api, ApiError } from "@/lib/api.ts";

/** Mirrors the server `UnifiedBalanceView`. */
interface UnifiedBalanceResponse {
  provisioned: boolean;
  address?: string;
  totalUsdc?: string;
  breakdown?: { chain: string; amount: string }[];
}

interface DepositResponse {
  txHash: string;
  explorerUrl?: string;
  amount: string;
}

type DepositStatus = "idle" | "depositing" | "success" | "error";

interface DepositState {
  status: DepositStatus;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

interface SpendResponse {
  status: "spent" | "delegate_pending";
  txHash?: string;
  explorerUrl?: string;
  transferId?: string;
  destinationChain: string;
  recipientAddress: string;
  amount: string;
  note?: string;
}

type SpendStatus = "idle" | "spending" | "success" | "pending" | "error";

interface SpendState {
  status: SpendStatus;
  txHash?: string;
  explorerUrl?: string;
  destinationChain?: string;
  note?: string;
  error?: string;
}

interface State {
  data: UnifiedBalanceResponse | null;
  loading: boolean;
  error: string | null;
  deposit: DepositState;
  spend: SpendState;
}

/**
 * The agent wallet's Circle Gateway unified (cross-chain) USDC balance, plus
 * deposit and spend actions (spend = settle USDC out to another Gateway chain,
 * signed by the server-side delegate).
 */
export function useUnifiedBalance() {
  const { authenticated, ready } = usePrivy();
  const [state, setState] = useState<State>({
    data: null,
    loading: true,
    error: null,
    deposit: { status: "idle" },
    spend: { status: "idle" },
  });

  const refetch = useCallback(async () => {
    if (!ready || !authenticated) return;
    // No synchronous setState here (the effect calls this) — only update on
    // resolve/reject so we don't trigger cascading effect renders.
    try {
      const data = await api.get<UnifiedBalanceResponse>("/api/agent/unified-balance");
      setState((s) => ({ ...s, data, loading: false, error: null }));
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error";
      setState((s) => ({ ...s, loading: false, error: msg }));
    }
  }, [authenticated, ready]);

  // Inline fetch on mount/auth-change. setState lives only in the async
  // callbacks (not synchronously in the effect) to satisfy the hooks rules;
  // `refetch` (above) is for event-driven refreshes after a deposit.
  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    api
      .get<UnifiedBalanceResponse>("/api/agent/unified-balance")
      .then((data) => {
        if (!cancelled) setState((s) => ({ ...s, data, loading: false, error: null }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Unknown error";
        setState((s) => ({ ...s, loading: false, error: msg }));
      });
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated]);

  const deposit = useCallback(
    async (amount: string) => {
      setState((s) => ({ ...s, deposit: { status: "depositing" } }));
      try {
        const res = await api.post<DepositResponse>("/api/agent/unified-balance/deposit", {
          amount,
        });
        setState((s) => ({
          ...s,
          deposit: {
            status: "success",
            txHash: res.txHash,
            ...(res.explorerUrl ? { explorerUrl: res.explorerUrl } : {}),
          },
        }));
        void refetch();
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Deposit failed";
        setState((s) => ({ ...s, deposit: { status: "error", error: msg } }));
      }
    },
    [refetch],
  );

  const resetDeposit = useCallback(() => {
    setState((s) => ({ ...s, deposit: { status: "idle" } }));
  }, []);

  const spend = useCallback(
    async (amount: string, destinationChain: string) => {
      setState((s) => ({ ...s, spend: { status: "spending" } }));
      try {
        const res = await api.post<SpendResponse>("/api/agent/unified-balance/spend", {
          amount,
          destinationChain,
        });
        if (res.status === "delegate_pending") {
          setState((s) => ({
            ...s,
            spend: {
              status: "pending",
              destinationChain: res.destinationChain,
              ...(res.note ? { note: res.note } : {}),
            },
          }));
          return;
        }
        setState((s) => ({
          ...s,
          spend: {
            status: "success",
            destinationChain: res.destinationChain,
            ...(res.txHash ? { txHash: res.txHash } : {}),
            ...(res.explorerUrl ? { explorerUrl: res.explorerUrl } : {}),
          },
        }));
        void refetch();
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Spend failed";
        setState((s) => ({ ...s, spend: { status: "error", error: msg } }));
      }
    },
    [refetch],
  );

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    depositState: state.deposit,
    deposit,
    resetDeposit,
    spendState: state.spend,
    spend,
    refetch,
  };
}

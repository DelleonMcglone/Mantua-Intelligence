import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { ApiError, api } from "@/lib/api.ts";
import { TOKENS, type TokenSymbol } from "@/lib/tokens.ts";

interface PortfolioBalance {
  symbol: TokenSymbol;
  address: `0x${string}`;
  decimals: number;
  balanceRaw: string;
  usdValue: number;
}

interface PortfolioResponse {
  address: string;
  balances: PortfolioBalance[];
}

interface PortfolioState {
  balances: PortfolioBalance[];
  loading: boolean;
  error: string | null;
  walletAddress: string | null;
}

const POLL_MS = 15_000;

/**
 * Live portfolio polling. Returns the real on-chain balances for the
 * connected Privy wallet on Base Sepolia (or null until login). Polls
 * `/api/portfolio` every 15s so balances update without requiring a
 * full page refresh after the user receives more testnet tokens.
 */
export function usePortfolio(): PortfolioState {
  const { authenticated, ready, user } = usePrivy();
  const wallet = user?.wallet?.address ?? null;
  const [state, setState] = useState<PortfolioState>({
    balances: [],
    loading: false,
    error: null,
    walletAddress: null,
  });

  useEffect(() => {
    if (!ready || !authenticated || !wallet) {
      setState({ balances: [], loading: false, error: null, walletAddress: null });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const data = await api.get<PortfolioResponse>("/api/portfolio");
        if (cancelled) return;
        setState({
          balances: data.balances,
          loading: false,
          error: null,
          walletAddress: data.address,
        });
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unknown error";
        setState((s) => ({ ...s, loading: false, error: message }));
      } finally {
        if (!cancelled) timer = setTimeout(() => void tick(), POLL_MS);
      }
    };

    setState((s) => ({ ...s, loading: true, walletAddress: wallet }));
    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [authenticated, ready, wallet]);

  return state;
}

export interface DisplayAsset {
  symbol: TokenSymbol;
  name: string;
  /** Human-readable balance (e.g. "1.234"). */
  qty: string;
  /** USD value formatted (e.g. "$3,250.00"). */
  val: string;
  /** Unit price (e.g. "$1.00"). */
  price: string;
  /** 24h percent change (placeholder until we wire a price feed). */
  pct: number;
  /** Raw on-chain balance (string of base units). */
  balanceRaw: string;
  decimals: number;
}

export function toDisplayAssets(balances: PortfolioBalance[]): DisplayAsset[] {
  return balances
    .filter((b) => b.symbol !== "WETH") // user-facing list excludes WETH
    .map((b) => {
      const meta = TOKENS[b.symbol];
      const qtyNum = Number(b.balanceRaw) / Math.pow(10, b.decimals);
      const unitPrice = qtyNum > 0 ? b.usdValue / qtyNum : 0;
      return {
        symbol: b.symbol,
        name: meta?.name ?? b.symbol,
        qty: formatQty(qtyNum, b.decimals),
        val: formatUsd(b.usdValue),
        price: unitPrice > 0 ? formatUsd(unitPrice) : "—",
        pct: 0,
        balanceRaw: b.balanceRaw,
        decimals: b.decimals,
      };
    });
}

function formatQty(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "0.00";
  if (value === 0) return "0.00";
  const dp = decimals === 6 ? 2 : decimals === 8 ? 6 : 4;
  return value.toLocaleString(undefined, { maximumFractionDigits: dp });
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "$0.00";
  if (value < 0.01) return "<$0.01";
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

import { ApiError } from "@/lib/api.ts";
import type { TokenSymbol } from "@/lib/tokens.ts";
import { parseTokenAmount } from "./format.ts";
import type { useSwap } from "./use-swap.ts";

export function safeParse(symbol: TokenSymbol, input: string): string {
  if (!input || input === ".") return "0";
  try {
    return parseTokenAmount(symbol, input).toString();
  } catch {
    return "0";
  }
}

export function ctaLabel(
  status: ReturnType<typeof useSwap>["state"]["status"],
  noQuote: boolean,
): string {
  if (noQuote) return "Enter an amount";
  switch (status) {
    case "signing":
      return "Sign in wallet…";
    case "submitting":
      return "Preparing transaction…";
    case "pending":
      return "Waiting for confirmation…";
    case "success":
      return "Done";
    default:
      return "Review swap";
  }
}

export function mapQuoteError(err: ApiError | Error | null): string | null {
  if (!err) return null;
  if (err instanceof ApiError) {
    switch (err.code) {
      case "spending_cap_exceeded":
      case "spending_cap_hard_ceiling":
      case "slippage_too_high":
        return err.message;
      case "KILL_SWITCH_ACTIVE":
        return "Mantua write operations are temporarily disabled.";
      case "RATE_LIMITED":
        return "Too many requests — please slow down.";
      case "UNAUTHENTICATED":
      case "WALLET_REQUIRED":
        return "Please log in to fetch a quote.";
      case "UPSTREAM_QUOTE":
        return "Upstream quote temporarily unavailable.";
      default:
        return err.message;
    }
  }
  return err.message;
}

export function mapSwapError(err: Error): string {
  const msg = err.message.toLowerCase();
  if (msg.includes("user rejected") || msg.includes("user denied")) return "Transaction rejected.";
  if (msg.includes("insufficient")) return "Insufficient balance for this swap.";
  if (msg.includes("kill")) return "Mantua write operations are temporarily disabled.";
  return err.message;
}

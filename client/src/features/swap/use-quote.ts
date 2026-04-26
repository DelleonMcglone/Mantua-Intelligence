import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api.ts";
import type { TokenSymbol } from "@/lib/tokens.ts";
import type { QuoteResponse } from "./types.ts";

interface UseQuoteParams {
  tokenIn: TokenSymbol;
  tokenOut: TokenSymbol;
  amountRaw: string;
  slippageBps?: number;
  enabled?: boolean;
}

interface QuoteState {
  data: QuoteResponse | null;
  error: ApiError | Error | null;
  loading: boolean;
}

const DEBOUNCE_MS = 350;

export function useQuote({
  tokenIn,
  tokenOut,
  amountRaw,
  slippageBps,
  enabled = true,
}: UseQuoteParams): QuoteState {
  const [state, setState] = useState<QuoteState>({ data: null, error: null, loading: false });

  useEffect(() => {
    if (!enabled || tokenIn === tokenOut || amountRaw === "0" || amountRaw === "") {
      setState({ data: null, error: null, loading: false });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    const timer = setTimeout(() => {
      void api
        .post<QuoteResponse>("/api/quote", {
          tokenIn,
          tokenOut,
          amountRaw,
          type: "EXACT_INPUT",
          ...(slippageBps !== undefined ? { slippageBps } : {}),
        })
        .then((data) => {
          if (cancelled) return;
          setState({ data, error: null, loading: false });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const e = err instanceof Error ? err : new Error("Unknown error");
          setState({ data: null, error: e, loading: false });
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tokenIn, tokenOut, amountRaw, slippageBps, enabled]);

  return state;
}

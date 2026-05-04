import { useEffect, useState } from "react";
import { api } from "@/lib/api.ts";
import { TOKENS, type TokenSymbol } from "@/lib/tokens.ts";
import { formatTokenAmount } from "./format.ts";
import type { QuoteResponse } from "./types.ts";

/**
 * Fetches a single "1 tokenIn" quote so the Swap panel can show a
 * baseline Exchange Rate row before the user types anything. Refreshes
 * whenever the token pair changes; otherwise idle.
 */
export function useBaselineRate(tokenIn: TokenSymbol, tokenOut: TokenSymbol): string {
  const [rate, setRate] = useState("");

  useEffect(() => {
    if (tokenIn === tokenOut) {
      setRate("");
      return;
    }
    const inDec = TOKENS[tokenIn].decimals;
    const oneUnit = String(10n ** BigInt(inDec));
    let cancelled = false;
    void api
      .post<QuoteResponse>("/api/quote", {
        tokenIn,
        tokenOut,
        amountRaw: oneUnit,
        type: "EXACT_INPUT",
      })
      .then((data) => {
        if (cancelled) return;
        const out = formatTokenAmount(tokenOut, data.quote.quote.output.amount);
        const parsed = parseFloat(out);
        if (!Number.isFinite(parsed) || parsed === 0) return;
        setRate(`1 ${tokenIn} = ${parsed.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${tokenOut}`);
      })
      .catch(() => {
        // Quote may not be available for this pair on testnet — silent.
      });
    return () => {
      cancelled = true;
    };
  }, [tokenIn, tokenOut]);

  return rate;
}

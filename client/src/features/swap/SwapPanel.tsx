import { type TokenSymbol } from "@/lib/tokens.ts";
import { TestnetSwapPanel } from "./TestnetSwapPanel.tsx";

interface SwapPanelProps {
  onClose?: () => void;
  /** Pre-seed the Sell + Buy token selectors. Used when the chat
   *  intent matcher pulls a pair out of the user's question
   *  ("swap USDC for cirBTC" → tokenIn=USDC, tokenOut=cirBTC). */
  initialTokenIn?: TokenSymbol;
  initialTokenOut?: TokenSymbol;
}

/**
 * Swap modal. Mantua runs on Arc Testnet only, where swaps execute
 * through the v4 stack (V4Quoter + PoolSwapTest) wired in
 * `TestnetSwapPanel`. Uniswap's Trading API doesn't index Arc, so there
 * is no mainnet/aggregator path — this component is a thin pass-through
 * that keeps the original `SwapPanel` import surface stable for callers.
 */
export function SwapPanel({ onClose, initialTokenIn, initialTokenOut }: SwapPanelProps = {}) {
  return (
    <TestnetSwapPanel
      {...(onClose ? { onClose } : {})}
      {...(initialTokenIn ? { initialTokenIn } : {})}
      {...(initialTokenOut ? { initialTokenOut } : {})}
    />
  );
}

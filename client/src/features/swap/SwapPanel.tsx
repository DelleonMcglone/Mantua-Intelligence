import { type TokenSymbol } from "@/lib/tokens.ts";
import type { HookName } from "@/features/liquidity/use-create-pool.ts";
import { TestnetSwapPanel, type SwapVenue } from "./TestnetSwapPanel.tsx";

interface SwapPanelProps {
  onClose?: () => void;
  /** Pre-seed the Sell + Buy token selectors. Used when the chat
   *  intent matcher pulls a pair out of the user's question
   *  ("swap USDC for cirBTC" → tokenIn=USDC, tokenOut=cirBTC). */
  initialTokenIn?: TokenSymbol;
  initialTokenOut?: TokenSymbol;
  /** Pre-select the hook and pre-fill the amount from a chat command
   *  ("swap 10 USDC for EURC with stable protection"). */
  initialHook?: HookName;
  initialAmount?: string;
  /** Pre-select the venue tab; "bridge" for bridge commands
   *  ("bridge 10 USDC to base"). */
  initialVenue?: SwapVenue;
  /** Bridge Kit sdkName of the destination chain, for bridge commands. */
  initialBridgeDestination?: string;
}

/**
 * Swap modal. Mantua runs on Arc Testnet only, where swaps execute
 * through the v4 stack (V4Quoter + PoolSwapTest) wired in
 * `TestnetSwapPanel`. Uniswap's Trading API doesn't index Arc, so there
 * is no mainnet/aggregator path — this component is a thin pass-through
 * that keeps the original `SwapPanel` import surface stable for callers.
 */
export function SwapPanel({
  onClose,
  initialTokenIn,
  initialTokenOut,
  initialHook,
  initialAmount,
  initialVenue,
  initialBridgeDestination,
}: SwapPanelProps = {}) {
  return (
    <TestnetSwapPanel
      {...(onClose ? { onClose } : {})}
      {...(initialTokenIn ? { initialTokenIn } : {})}
      {...(initialTokenOut ? { initialTokenOut } : {})}
      {...(initialHook ? { initialHook } : {})}
      {...(initialAmount ? { initialAmount } : {})}
      {...(initialVenue ? { initialVenue } : {})}
      {...(initialBridgeDestination ? { initialBridgeDestination } : {})}
    />
  );
}

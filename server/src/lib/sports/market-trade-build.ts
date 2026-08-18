/**
 * One builder for every outcome-token trade — the user route, the strategy
 * executor, and the agent all call THIS, so there is exactly one place that
 * knows how to quote and encode a market swap. Divergence between "what the
 * user's button does" and "what the automation does" is the bug class this
 * file exists to prevent.
 */

import { parseAbi } from "viem";
import { baseRpcClient } from "../rpc-client.ts";
import { computeMarketId } from "../market-id.ts";
import { buildPoolSwapTestCalldata } from "../v4-onchain-swap.ts";
import { DYNAMIC_MARKET_ARC } from "../v4-contracts.ts";
import {
  MARKETS_ARC,
  MARKETS_PERIPHERY_ARC,
  MARKET_ABI,
  MARKET_FACTORY_ABI,
} from "../markets-contracts.ts";
import { planMarketPool } from "./market-pool.ts";

const V4_QUOTER_ABI = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "struct QuoteExactSingleParams { PoolKey poolKey; bool zeroForOne; uint128 exactAmount; bytes hookData; }",
  "function quoteExactInputSingle(QuoteExactSingleParams params) returns (uint256 amountOut, uint256 gasEstimate)",
]);

export class NoMarketError extends Error {
  constructor(providerEventId: string) {
    super(`No market for game ${providerEventId}`);
    this.name = "NoMarketError";
  }
}

export interface BuiltMarketTrade {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
  approvalTarget: `0x${string}` | null;
  inputToken: `0x${string}`;
  marketId: `0x${string}`;
  marketAddress: `0x${string}`;
  yesToken: `0x${string}`;
  quote: { amountIn: string; amountOut: string; effectivePriceBps: number | null };
}

/**
 * Quote + encode one trade. `direction` "buy" spends USDC for YES;
 * "sell" spends YES for USDC. `amountRaw` is the exact input (6dp).
 */
export async function buildMarketTrade(args: {
  providerEventId: string;
  outcomeIndex: 0 | 1;
  direction: "buy" | "sell";
  amountRaw: bigint;
}): Promise<BuiltMarketTrade> {
  const marketId = computeMarketId({
    providerEventId: args.providerEventId,
    marketType: "moneyline",
    outcomeIndex: args.outcomeIndex,
  });
  const marketAddress = await baseRpcClient.readContract({
    address: MARKETS_ARC.factory,
    abi: MARKET_FACTORY_ABI,
    functionName: "marketOf",
    args: [marketId],
  });
  if (marketAddress === "0x0000000000000000000000000000000000000000") {
    throw new NoMarketError(args.providerEventId);
  }
  const yesToken = await baseRpcClient.readContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "yesToken",
  });
  const plan = planMarketPool(yesToken, MARKETS_ARC.collateral, DYNAMIC_MARKET_ARC.hook, 0.5);

  const inputIsYes = args.direction === "sell";
  const zeroForOne = inputIsYes ? plan.yesIsToken0 : !plan.yesIsToken0;

  const { result } = await baseRpcClient.simulateContract({
    address: MARKETS_PERIPHERY_ARC.quoter,
    abi: V4_QUOTER_ABI,
    functionName: "quoteExactInputSingle",
    args: [{ poolKey: plan.key, zeroForOne, exactAmount: args.amountRaw, hookData: "0x" }],
  });
  const [amountOut] = result;

  const calldata = buildPoolSwapTestCalldata({
    poolKey: plan.key,
    zeroForOne,
    amountInRaw: args.amountRaw,
  });

  const usdc = args.direction === "buy" ? args.amountRaw : amountOut;
  const yes = args.direction === "buy" ? amountOut : args.amountRaw;
  const effectivePriceBps = yes > 0n ? Number((usdc * 10_000n) / yes) : null;

  return {
    ...calldata,
    inputToken: inputIsYes ? yesToken : MARKETS_ARC.collateral,
    marketId,
    marketAddress,
    yesToken,
    quote: {
      amountIn: args.amountRaw.toString(),
      amountOut: amountOut.toString(),
      effectivePriceBps,
    },
  };
}

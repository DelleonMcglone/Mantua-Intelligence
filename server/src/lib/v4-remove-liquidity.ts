import { encodeAbiParameters, encodeFunctionData } from "viem";
import { getAmountsForLiquidity } from "./amounts-for-liquidity.ts";
import { getSqrtRatioAtTick } from "./tick-math.ts";
import { Action, encodeActions, encodeSweep, encodeUnlockData } from "./v4-actions.ts";
import {
  POSITION_MANAGER_MODIFY_LIQUIDITIES_ABI,
  V4_POSITION_MANAGER,
} from "./v4-contracts.ts";

const SLIPPAGE_DENOM = 10_000n;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

export interface BuildRemoveLiquidityArgs {
  tokenId: bigint;
  liquidityToRemove: bigint;
  positionLiquidity: bigint;
  tickLower: number;
  tickUpper: number;
  sqrtPriceX96: bigint;
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  slippageBps: number;
  recipient: `0x${string}`;
  deadlineSeconds: number;
}

export interface BuildRemoveLiquidityResult {
  to: `0x${string}`;
  data: `0x${string}`;
  amount0Min: string;
  amount1Min: string;
  amount0Estimate: string;
  amount1Estimate: string;
  isFullExit: boolean;
}

/** DECREASE_LIQUIDITY params: (tokenId, liquidity, amount0Min, amount1Min, hookData) */
function encodeDecrease(
  tokenId: bigint,
  liquidity: bigint,
  amount0Min: bigint,
  amount1Min: bigint,
): `0x${string}` {
  return encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint128" },
      { type: "uint128" },
      { type: "bytes" },
    ],
    [tokenId, liquidity, amount0Min, amount1Min, "0x"],
  );
}

/** BURN_POSITION params: (tokenId, amount0Min, amount1Min, hookData) */
function encodeBurn(
  tokenId: bigint,
  amount0Min: bigint,
  amount1Min: bigint,
): `0x${string}` {
  return encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint128" }, { type: "uint128" }, { type: "bytes" }],
    [tokenId, amount0Min, amount1Min, "0x"],
  );
}

/** TAKE_PAIR params: (currency0, currency1, recipient) */
function encodeTakePair(
  c0: `0x${string}`,
  c1: `0x${string}`,
  recipient: `0x${string}`,
): `0x${string}` {
  return encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "address" }],
    [c0, c1, recipient],
  );
}

export function buildRemoveLiquidityCalldata(
  args: BuildRemoveLiquidityArgs,
): BuildRemoveLiquidityResult {
  if (args.liquidityToRemove <= 0n || args.liquidityToRemove > args.positionLiquidity) {
    throw new Error("Invalid liquidity amount");
  }
  const isFullExit = args.liquidityToRemove === args.positionLiquidity;

  const sqrtLower = getSqrtRatioAtTick(args.tickLower);
  const sqrtUpper = getSqrtRatioAtTick(args.tickUpper);
  const { amount0, amount1 } = getAmountsForLiquidity({
    sqrtPriceCurrentX96: args.sqrtPriceX96,
    sqrtPriceLowerX96: sqrtLower,
    sqrtPriceUpperX96: sqrtUpper,
    liquidity: args.liquidityToRemove,
  });

  const slippage = BigInt(args.slippageBps);
  const amount0Min = (amount0 * (SLIPPAGE_DENOM - slippage)) / SLIPPAGE_DENOM;
  const amount1Min = (amount1 * (SLIPPAGE_DENOM - slippage)) / SLIPPAGE_DENOM;

  const decreaseOrBurn = isFullExit
    ? encodeBurn(args.tokenId, amount0Min, amount1Min)
    : encodeDecrease(args.tokenId, args.liquidityToRemove, amount0Min, amount1Min);

  const takePair = encodeTakePair(args.currency0, args.currency1, args.recipient);

  // Add SWEEP for native-ETH side so dust gets refunded.
  const nativeSide = args.currency0 === ZERO ? "0" : args.currency1 === ZERO ? "1" : null;
  const ids = nativeSide
    ? [isFullExit ? Action.BURN_POSITION : Action.DECREASE_LIQUIDITY, Action.TAKE_PAIR, Action.SWEEP]
    : [isFullExit ? Action.BURN_POSITION : Action.DECREASE_LIQUIDITY, Action.TAKE_PAIR];

  const params: `0x${string}`[] = [decreaseOrBurn, takePair];
  if (nativeSide) params.push(encodeSweep(ZERO, args.recipient));

  const unlockData = encodeUnlockData(encodeActions(ids), params);
  const data = encodeFunctionData({
    abi: POSITION_MANAGER_MODIFY_LIQUIDITIES_ABI,
    functionName: "modifyLiquidities",
    args: [unlockData, BigInt(args.deadlineSeconds)],
  });

  return {
    to: V4_POSITION_MANAGER,
    data,
    amount0Min: amount0Min.toString(),
    amount1Min: amount1Min.toString(),
    amount0Estimate: amount0.toString(),
    amount1Estimate: amount1.toString(),
    isFullExit,
  };
}

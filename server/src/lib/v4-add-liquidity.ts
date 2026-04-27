import { encodeFunctionData, keccak256, toHex } from "viem";
import { getLiquidityForAmounts } from "./liquidity-math.ts";
import { buildPoolKey } from "./pool-key.ts";
import { getMaxUsableTick, getMinUsableTick, getSqrtRatioAtTick } from "./tick-math.ts";
import { type TokenSymbol } from "./tokens.ts";
import {
  Action,
  encodeActions,
  encodeMintPosition,
  encodeSettlePair,
  encodeSweep,
  encodeUnlockData,
} from "./v4-actions.ts";
import {
  POSITION_MANAGER_MODIFY_LIQUIDITIES_ABI,
  V4_POSITION_MANAGER,
  type FeeTier,
} from "./v4-contracts.ts";

const SLIPPAGE_DENOM = 10_000n;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

export interface BuildAddLiquidityArgs {
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  fee: FeeTier;
  amountARaw: bigint;
  amountBRaw: bigint;
  sqrtPriceX96: bigint;
  slippageBps: number;
  owner: `0x${string}`;
  deadlineSeconds: number;
}

export interface BuildAddLiquidityResult {
  to: `0x${string}`;
  data: `0x${string}`;
  /** ETH value to attach if currency0 or currency1 is native ETH (zero address). */
  value: string;
  liquidity: string;
  amount0Max: string;
  amount1Max: string;
  tickLower: number;
  tickUpper: number;
  poolKeyHash: `0x${string}`;
}

/**
 * Build a full-range MINT_POSITION + SETTLE_PAIR (+ SWEEP for native-ETH
 * sides) unlockData for the v4 PositionManager. Liquidity is computed
 * from the user's max amounts at the current sqrtPrice; on-chain the
 * contract pulls at most amount0Max + amount1Max and reverts otherwise.
 */
export function buildAddLiquidityCalldata(args: BuildAddLiquidityArgs): BuildAddLiquidityResult {
  const { key, flipped } = buildPoolKey(args.tokenA, args.tokenB, args.fee);
  const tickLower = getMinUsableTick(key.tickSpacing);
  const tickUpper = getMaxUsableTick(key.tickSpacing);
  const sqrtLower = getSqrtRatioAtTick(tickLower);
  const sqrtUpper = getSqrtRatioAtTick(tickUpper);

  const amount0Raw = flipped ? args.amountBRaw : args.amountARaw;
  const amount1Raw = flipped ? args.amountARaw : args.amountBRaw;
  const liquidity = getLiquidityForAmounts({
    sqrtPriceCurrentX96: args.sqrtPriceX96,
    sqrtPriceLowerX96: sqrtLower,
    sqrtPriceUpperX96: sqrtUpper,
    amount0: amount0Raw,
    amount1: amount1Raw,
  });
  if (liquidity === 0n) {
    throw new Error("Computed liquidity is zero — increase amounts");
  }

  const slippage = BigInt(args.slippageBps);
  const amount0Max = (amount0Raw * (SLIPPAGE_DENOM + slippage)) / SLIPPAGE_DENOM;
  const amount1Max = (amount1Raw * (SLIPPAGE_DENOM + slippage)) / SLIPPAGE_DENOM;

  const mintParams = encodeMintPosition({
    poolKey: key,
    tickLower,
    tickUpper,
    liquidity,
    amount0Max,
    amount1Max,
    owner: args.owner,
    hookData: "0x",
  });
  const settleParams = encodeSettlePair(key.currency0, key.currency1);

  const nativeSide = key.currency0 === ZERO ? "0" : key.currency1 === ZERO ? "1" : null;
  const ids = nativeSide
    ? [Action.MINT_POSITION, Action.SETTLE_PAIR, Action.SWEEP]
    : [Action.MINT_POSITION, Action.SETTLE_PAIR];
  const params: `0x${string}`[] = [mintParams, settleParams];
  if (nativeSide) params.push(encodeSweep(ZERO, args.owner));

  const unlockData = encodeUnlockData(encodeActions(ids), params);
  const data = encodeFunctionData({
    abi: POSITION_MANAGER_MODIFY_LIQUIDITIES_ABI,
    functionName: "modifyLiquidities",
    args: [unlockData, BigInt(args.deadlineSeconds)],
  });

  const value =
    nativeSide === "0" ? amount0Max.toString() : nativeSide === "1" ? amount1Max.toString() : "0";

  const poolKeyHash = keccak256(
    toHex(
      `${key.currency0}|${key.currency1}|${String(key.fee)}|${String(key.tickSpacing)}|${key.hooks}`,
    ),
  );

  return {
    to: V4_POSITION_MANAGER,
    data,
    value,
    liquidity: liquidity.toString(),
    amount0Max: amount0Max.toString(),
    amount1Max: amount1Max.toString(),
    tickLower,
    tickUpper,
    poolKeyHash,
  };
}

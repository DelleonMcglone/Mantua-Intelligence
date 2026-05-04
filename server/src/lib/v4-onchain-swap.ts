import { encodeFunctionData, type Address } from "viem";
import { buildPoolKey, type PoolKey } from "./pool-key.ts";
import { baseRpcClient } from "./rpc-client.ts";
import { getToken, type TokenSymbol } from "./tokens.ts";
import {
  HOOK_NAMES,
  POOL_SWAP_TEST,
  POOL_SWAP_TEST_ABI,
  V4_QUOTER,
  V4_QUOTER_ABI,
  getHookAddress,
  type FeeTier,
  type HookName,
} from "./v4-contracts.ts";

/**
 * v4 sqrt price limits. Anything inside `MIN_SQRT_PRICE_LIMIT <
 * sqrtPriceX96 < MAX_SQRT_PRICE_LIMIT` is accepted; using these
 * extremes effectively disables price-impact protection at the
 * PoolManager level. Slippage is enforced upstream via the quote +
 * client-supplied tolerance.
 */
const MIN_SQRT_PRICE_LIMIT = 4295128740n; // TickMath.MIN_SQRT_PRICE + 1
const MAX_SQRT_PRICE_LIMIT = 1461446703485210103287273052203988822378723970341n; // TickMath.MAX_SQRT_PRICE - 1

export interface OnchainQuoteArgs {
  tokenIn: TokenSymbol;
  tokenOut: TokenSymbol;
  fee: FeeTier;
  hook: HookName | null;
  amountInRaw: bigint;
}

export interface OnchainQuoteResult {
  poolKey: PoolKey;
  zeroForOne: boolean;
  amountIn: string;
  amountOut: string;
  gasEstimate: string;
}

function resolveHookAddress(hook: HookName | null): `0x${string}` {
  if (!hook) return "0x0000000000000000000000000000000000000000";
  if (!HOOK_NAMES.includes(hook)) return "0x0000000000000000000000000000000000000000";
  return getHookAddress(hook) ?? "0x0000000000000000000000000000000000000000";
}

/**
 * Build the v4 PoolKey and call `V4Quoter.quoteExactInputSingle` via
 * `eth_call`. Returns the simulated `amountOut` plus the constructed
 * `poolKey` (caller will reuse it to build PoolSwapTest calldata).
 */
export async function quoteExactInputV4(
  args: OnchainQuoteArgs,
): Promise<OnchainQuoteResult> {
  const hookAddress = resolveHookAddress(args.hook);
  const { key } = buildPoolKey(args.tokenIn, args.tokenOut, args.fee, hookAddress, args.hook);

  const tokenInAddr = getToken(args.tokenIn).native
    ? "0x0000000000000000000000000000000000000000"
    : getToken(args.tokenIn).address;
  const zeroForOne = tokenInAddr.toLowerCase() === key.currency0.toLowerCase();

  const { result } = await baseRpcClient.simulateContract({
    address: V4_QUOTER,
    abi: V4_QUOTER_ABI,
    functionName: "quoteExactInputSingle",
    args: [
      {
        poolKey: {
          currency0: key.currency0,
          currency1: key.currency1,
          fee: key.fee,
          tickSpacing: key.tickSpacing,
          hooks: key.hooks,
        },
        zeroForOne,
        exactAmount: args.amountInRaw,
        hookData: "0x",
      },
    ],
  });

  const [amountOut, gasEstimate] = result;
  return {
    poolKey: key,
    zeroForOne,
    amountIn: args.amountInRaw.toString(),
    amountOut: amountOut.toString(),
    gasEstimate: gasEstimate.toString(),
  };
}

export interface SwapCalldataArgs {
  poolKey: PoolKey;
  zeroForOne: boolean;
  amountInRaw: bigint;
}

export interface SwapCalldataResult {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
  /** Approval target for the input ERC-20. Null when input is native ETH. */
  approvalTarget: `0x${string}` | null;
}

/**
 * Build calldata for `PoolSwapTest.swap`. Caller (the client) must
 * either approve the input ERC-20 to `approvalTarget` first or — for
 * native ETH input — pass the right `value` and skip the approval.
 *
 * `sqrtPriceLimitX96` is set to the absolute extremes so the
 * PoolManager doesn't reject on price-bound — the user's effective
 * slippage protection is the `amountOutMinimum` we'll surface in the
 * UI from the quote (this signature returns the raw swap; min-out
 * checking is on the caller).
 */
export function buildPoolSwapTestCalldata(args: SwapCalldataArgs): SwapCalldataResult {
  if (!POOL_SWAP_TEST) {
    throw new Error("PoolSwapTest is not deployed on this network");
  }
  const sqrtPriceLimit = args.zeroForOne ? MIN_SQRT_PRICE_LIMIT : MAX_SQRT_PRICE_LIMIT;
  // amountSpecified: negative = exact-input (the convention v4-core uses).
  const amountSpecified = -args.amountInRaw;
  const data = encodeFunctionData({
    abi: POOL_SWAP_TEST_ABI,
    functionName: "swap",
    args: [
      {
        currency0: args.poolKey.currency0,
        currency1: args.poolKey.currency1,
        fee: args.poolKey.fee,
        tickSpacing: args.poolKey.tickSpacing,
        hooks: args.poolKey.hooks,
      },
      {
        zeroForOne: args.zeroForOne,
        amountSpecified,
        sqrtPriceLimitX96: sqrtPriceLimit,
      },
      {
        takeClaims: false,
        settleUsingBurn: false,
      },
      "0x",
    ],
  });

  const inputCurrency = args.zeroForOne ? args.poolKey.currency0 : args.poolKey.currency1;
  const isNativeIn =
    inputCurrency.toLowerCase() === "0x0000000000000000000000000000000000000000";

  return {
    to: POOL_SWAP_TEST,
    data,
    value: isNativeIn ? args.amountInRaw.toString() : "0",
    approvalTarget: isNativeIn ? null : (POOL_SWAP_TEST as Address),
  };
}

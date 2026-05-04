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
 * Inspect a viem-thrown error from V4Quoter and turn known reverts
 * into human-friendly messages. Quoter wraps any internal failure as
 * `UnexpectedRevertBytes(bytes)` (selector `0x6190b2b0`) — that
 * usually means the pool hasn't been initialized for the requested
 * key, the hook rejected the swap, or the input amount exceeded
 * available liquidity.
 */
function friendlyQuoterError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (/0x6190b2b0|UnexpectedRevertBytes/i.test(msg)) {
    return new Error(
      "Quote failed — pool may be missing liquidity, the hook rejected the swap, or the requested amount is larger than the pool can support. Try a smaller amount.",
    );
  }
  if (/PoolNotInitialized|0x[0-9a-f]+ not initialized/i.test(msg)) {
    return new Error("Pool not initialized for this pair + fee + hook combination.");
  }
  if (err instanceof Error) return err;
  return new Error("Quote failed");
}

/**
 * Binary-search the largest input amount that V4Quoter can quote for
 * the given pool key without reverting. Used by the swap panel's
 * percent chips on testnet so a 25% / 50% / Max click can't overshoot
 * pool depth (or land on a non-existent pool).
 *
 * `upperBound` is the user's wallet balance in raw base units —
 * if the pool can absorb that much, we short-circuit and return it
 * directly. Otherwise we binary-search the [0, upperBound] interval.
 *
 * 24 iterations is enough to converge on any bound under 2^24 of
 * raw-unit precision, which for a 6-dec stablecoin is ~16 USD —
 * fine resolution for percent chips. Each iteration is one
 * `eth_call`; total worst-case RPC fan-out is 25 (one direct probe
 * + 24 search steps), only fired when the user actually clicks
 * a percent chip.
 */
export async function findMaxQuotableInputV4(
  args: Omit<OnchainQuoteArgs, "amountInRaw"> & { upperBound: bigint },
): Promise<bigint> {
  const { upperBound, ...rest } = args;
  if (upperBound === 0n) return 0n;

  // Direct probe at the full upper bound — if it works, the pool can
  // absorb the user's whole balance and no cap is needed.
  try {
    await quoteExactInputV4({ ...rest, amountInRaw: upperBound });
    return upperBound;
  } catch {
    // Fall through to binary search.
  }

  let lo = 0n;
  let hi = upperBound;
  for (let i = 0; i < 24; i++) {
    if (hi - lo <= 1n) break;
    const mid = (lo + hi) / 2n;
    if (mid === lo) break;
    try {
      await quoteExactInputV4({ ...rest, amountInRaw: mid });
      lo = mid;
    } catch {
      hi = mid;
    }
  }
  return lo;
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

  try {
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
  } catch (err) {
    throw friendlyQuoterError(err);
  }
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

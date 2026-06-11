import { BaseError, decodeAbiParameters, decodeErrorResult, encodeFunctionData } from "viem";
import { buildPoolKey, type PoolKey } from "./pool-key.ts";
import { logger } from "./logger.ts";
import { getRpcClient } from "./rpc-client.ts";
import {
  DEFAULT_CHAIN_ID,
  type SupportedTestnetChainId,
} from "./chains.ts";
import { getToken, type TokenSymbol } from "./tokens.ts";
import {
  HOOK_NAMES,
  POOL_SWAP_TEST_ABI,
  V4_QUOTER_ABI,
  getHookAddress,
  getV4StackForHook,
  type FeeTier,
  type HookName,
} from "./v4-contracts.ts";
import { assertHookPairAllowedBySymbol } from "./hook-pair-gating.ts";
import { readSlot0 } from "./v4-state-view.ts";

/**
 * Walk a viem error tree to find the raw revert data hex string
 * (`0x<selector><payload>`). Returns null when no contract revert
 * data is attached (e.g. RPC transport error, not a revert).
 */
function extractRevertHex(err: unknown): `0x${string}` | null {
  if (!(err instanceof BaseError)) return null;
  const found = err.walk(
    (e): e is BaseError & { data?: unknown; cause?: unknown } => {
      const candidate = e as { data?: unknown };
      return typeof candidate.data === "string" && candidate.data.startsWith("0x");
    },
  ) as (BaseError & { data?: `0x${string}` }) | null;
  return found?.data ?? null;
}

interface DecodedQuoterRevert {
  outerHex: `0x${string}` | null;
  innerHex: `0x${string}` | null;
  innerSelector: `0x${string}` | null;
  decoded: string | null;
  /** When inner is v4-core's `WrappedError(address,bytes4,bytes,bytes)`,
   *  the unwrapped hook-side revert reason + best-effort decoding. */
  hookTarget?: `0x${string}`;
  hookFnSelector?: `0x${string}`;
  hookReasonHex?: `0x${string}`;
  hookReasonSelector?: `0x${string}`;
  hookReasonDecoded?: string;
}

/**
 * Known stable-protection-hook custom errors. Mirror of the on-chain
 * ABI for `0xe5e6a9...20C0` — used to translate `0x<selector>` bytes
 * coming back through `WrappedError` into a readable name.
 */
const STABLE_PROTECTION_HOOK_ERRORS = [
  { type: "error", name: "CircuitBreakerTripped", inputs: [{ type: "uint8", name: "zone" }, { type: "uint256", name: "deviationBps" }] },
  { type: "error", name: "InvalidConfiguration", inputs: [{ type: "string", name: "reason" }] },
  { type: "error", name: "NotPoolManager", inputs: [] },
  { type: "error", name: "AlreadyInitialized", inputs: [] },
] as const;

/**
 * Decode `0x<selector><payload>` into a readable string. Handles
 * `Error(string)`, `Panic(uint256)`, and any custom error in
 * `STABLE_PROTECTION_HOOK_ERRORS`. Returns null when nothing matches.
 */
function decodeRevertBytes(hex: `0x${string}`): string | null {
  if (hex.length < 10) return null;
  try {
    const decoded = decodeErrorResult({
      abi: [
        { type: "error", name: "Error", inputs: [{ type: "string", name: "message" }] },
        { type: "error", name: "Panic", inputs: [{ type: "uint256", name: "code" }] },
        ...STABLE_PROTECTION_HOOK_ERRORS,
      ],
      data: hex,
    });
    if (decoded.errorName === "Error") {
      const message = decoded.args[0];
      return `Error: ${typeof message === "string" ? message : "(non-string)"}`;
    }
    if (decoded.errorName === "Panic") {
      const code = decoded.args[0];
      return `Panic(0x${typeof code === "bigint" ? code.toString(16) : "?"})`;
    }
    const argsStr = (decoded.args as readonly unknown[])
      .map((a) => (typeof a === "bigint" ? a.toString() : JSON.stringify(a)))
      .join(", ");
    return `${decoded.errorName}(${argsStr})`;
  } catch {
    return null;
  }
}

/**
 * Decode the inner revert payload from V4Quoter's
 * `UnexpectedRevertBytes(bytes)` (selector `0x6190b2b0`). When that
 * inner payload is v4-core's `WrappedError(address,bytes4,bytes,bytes)`
 * (selector `0x90bfb865`) — which is how PoolManager wraps any hook
 * revert — peel that wrapper too and surface the actual hook-side
 * revert reason. Otherwise return whatever we could decode.
 */
function decodeQuoterRevert(err: unknown): DecodedQuoterRevert {
  const outerHex = extractRevertHex(err);
  if (!outerHex) return { outerHex: null, innerHex: null, innerSelector: null, decoded: null };

  // UnexpectedRevertBytes(bytes) — selector 0x6190b2b0.
  if (!outerHex.toLowerCase().startsWith("0x6190b2b0")) {
    return {
      outerHex,
      innerHex: null,
      innerSelector: outerHex.slice(0, 10).toLowerCase() as `0x${string}`,
      decoded: decodeRevertBytes(outerHex),
    };
  }
  let innerHex: `0x${string}`;
  try {
    const payload = ("0x" + outerHex.slice(10)) as `0x${string}`;
    const [bytes] = decodeAbiParameters([{ type: "bytes" }], payload);
    innerHex = bytes;
  } catch {
    return { outerHex, innerHex: null, innerSelector: null, decoded: "unwrap failed" };
  }
  if (innerHex.length < 10) {
    return { outerHex, innerHex, innerSelector: null, decoded: "empty inner payload" };
  }
  const innerSelector = innerHex.slice(0, 10).toLowerCase() as `0x${string}`;

  // v4-core's WrappedError(address,bytes4,bytes,bytes) — selector 0x90bfb865.
  // PoolManager uses this whenever a hook callback reverts. Peel it
  // to surface the hook's actual revert reason.
  if (innerSelector === "0x90bfb865") {
    try {
      const payload = ("0x" + innerHex.slice(10)) as `0x${string}`;
      const [target, fnSelector, reason] = decodeAbiParameters(
        [
          { type: "address", name: "target" },
          { type: "bytes4", name: "selector" },
          { type: "bytes", name: "reason" },
          { type: "bytes", name: "details" },
        ],
        payload,
      ) as unknown as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];
      const reasonSelector =
        reason.length >= 10 ? (reason.slice(0, 10).toLowerCase() as `0x${string}`) : undefined;
      const reasonDecoded = decodeRevertBytes(reason);
      return {
        outerHex,
        innerHex,
        innerSelector,
        decoded: reasonDecoded ?? `WrappedError(hook=${target}, fn=${fnSelector}, reason=${reason})`,
        hookTarget: target,
        hookFnSelector: fnSelector,
        hookReasonHex: reason,
        ...(reasonSelector ? { hookReasonSelector: reasonSelector } : {}),
        ...(reasonDecoded ? { hookReasonDecoded: reasonDecoded } : {}),
      };
    } catch {
      return {
        outerHex,
        innerHex,
        innerSelector,
        decoded: "WrappedError unwrap failed",
      };
    }
  }

  return {
    outerHex,
    innerHex,
    innerSelector,
    decoded: decodeRevertBytes(innerHex),
  };
}

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
  /** Target chain for the on-chain quote. Defaults to Base Sepolia
   *  for legacy callers that haven't been threaded yet. */
  chainId?: SupportedTestnetChainId;
}

export interface OnchainQuoteResult {
  poolKey: PoolKey;
  zeroForOne: boolean;
  amountIn: string;
  amountOut: string;
  gasEstimate: string;
}

function resolveHookAddress(
  hook: HookName | null,
  chainId: SupportedTestnetChainId,
): `0x${string}` {
  if (!hook) return "0x0000000000000000000000000000000000000000";
  if (!HOOK_NAMES.includes(hook)) return "0x0000000000000000000000000000000000000000";
  return getHookAddress(hook, chainId) ?? "0x0000000000000000000000000000000000000000";
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
      { cause: err },
    );
  }
  if (/PoolNotInitialized|0x[0-9a-f]+ not initialized/i.test(msg)) {
    return new Error("Pool not initialized for this pair + fee + hook combination.", { cause: err });
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
export interface MaxQuotableResult {
  maxInput: bigint;
  /** When every probe reverted, a human-readable reason derived from
   *  the upper-bound probe's revert data. Null when the pool absorbed
   *  the swap or when no decode was possible. */
  reason: string | null;
}

export async function findMaxQuotableInputV4(
  args: Omit<OnchainQuoteArgs, "amountInRaw"> & { upperBound: bigint },
): Promise<MaxQuotableResult> {
  const { upperBound, ...rest } = args;
  if (upperBound === 0n) return { maxInput: 0n, reason: null };
  // Skip the 25 wasted `eth_call`s when the hook×pair combo is
  // already known to be disallowed — surfaces the same maxInput=0
  // outcome the binary search would converge on.
  if (rest.hook) {
    assertHookPairAllowedBySymbol(rest.hook, rest.tokenIn, rest.tokenOut);
  }

  // Direct probe at the full upper bound — if it works, the pool can
  // absorb the user's whole balance and no cap is needed. On failure
  // we hold onto the raw viem error so we can decode V4Quoter's
  // `UnexpectedRevertBytes` wrapper and surface the actual inner
  // revert reason when every later probe also reverts.
  const firstError = await (async (): Promise<unknown> => {
    try {
      await quoteExactInputV4({ ...rest, amountInRaw: upperBound });
      return null;
    } catch (err) {
      return err;
    }
  })();
  if (firstError === null) return { maxInput: upperBound, reason: null };

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
  let reason: string | null = null;
  if (lo === 0n) {
    // Every probe reverted — the pool may be missing, the hook may be
    // rejecting, or liquidity may be out of range. Decode V4Quoter's
    // `UnexpectedRevertBytes` wrapper from the upper-bound probe to
    // surface the actual inner selector + reason. Walks the original
    // viem error chained via `cause` from `friendlyQuoterError`.
    const cause =
      firstError instanceof Error && firstError.cause ? firstError.cause : firstError;
    const decodedRevert = decodeQuoterRevert(cause);
    const friendlyMessage = firstError instanceof Error ? firstError.message : "non-Error throw";
    reason =
      decodedRevert.hookReasonDecoded ?? decodedRevert.decoded ?? friendlyMessage;
    // When we couldn't decode a specific pool/hook reason, the generic
    // friendlyMessage ("pool may be missing liquidity…") is misleading
    // for a pool that actually exists. Disambiguate with a slot0 read so
    // an initialized pool reports a hook/liquidity rejection, not a
    // missing pool. One extra eth_call, only on the undecodable path.
    if (!decodedRevert.hookReasonDecoded && !decodedRevert.decoded) {
      const probeChainId = args.chainId ?? DEFAULT_CHAIN_ID;
      try {
        const hookAddr = resolveHookAddress(args.hook, probeChainId);
        const { key } = buildPoolKey(
          args.tokenIn,
          args.tokenOut,
          args.fee,
          hookAddr,
          args.hook,
          probeChainId,
        );
        const slot0 = await readSlot0(key, probeChainId);
        reason = slot0
          ? "The pool exists but the swap was rejected — the hook may have paused swaps (e.g. Stable Protection's circuit breaker during a depeg) or liquidity is out of range. Try a smaller amount or a different hook."
          : "No pool is initialized for this pair at this fee tier and hook. Try a different fee tier, hook, or pair.";
      } catch {
        // Keep the friendlyMessage fallback if the slot0 read fails.
      }
    }
    logger.warn(
      {
        tokenIn: args.tokenIn,
        tokenOut: args.tokenOut,
        fee: args.fee,
        hook: args.hook,
        upperBound: upperBound.toString(),
        friendly: friendlyMessage.slice(0, 200),
        outerHex: decodedRevert.outerHex ? decodedRevert.outerHex.slice(0, 80) : null,
        innerSelector: decodedRevert.innerSelector,
        innerHex: decodedRevert.innerHex ? decodedRevert.innerHex.slice(0, 600) : null,
        decoded: decodedRevert.decoded,
        hookTarget: decodedRevert.hookTarget,
        hookFnSelector: decodedRevert.hookFnSelector,
        hookReasonSelector: decodedRevert.hookReasonSelector,
        hookReasonHex: decodedRevert.hookReasonHex
          ? decodedRevert.hookReasonHex.slice(0, 400)
          : undefined,
        hookReasonDecoded: decodedRevert.hookReasonDecoded,
      },
      "v4 max-input: every probe reverted",
    );
  }
  return { maxInput: lo, reason };
}

/**
 * Build the v4 PoolKey and call `V4Quoter.quoteExactInputSingle` via
 * `eth_call`. Returns the simulated `amountOut` plus the constructed
 * `poolKey` (caller will reuse it to build PoolSwapTest calldata).
 */
export async function quoteExactInputV4(
  args: OnchainQuoteArgs,
): Promise<OnchainQuoteResult> {
  // Reject hook/pair combos the hook is known to reject on-chain
  // before burning an `eth_call`. Surfaces a clean reason instead of
  // V4Quoter's wrapped revert.
  if (args.hook) {
    assertHookPairAllowedBySymbol(args.hook, args.tokenIn, args.tokenOut);
  }
  const chainId = args.chainId ?? DEFAULT_CHAIN_ID;
  const hookAddress = resolveHookAddress(args.hook, chainId);
  const { key } = buildPoolKey(
    args.tokenIn,
    args.tokenOut,
    args.fee,
    hookAddress,
    args.hook,
    chainId,
  );

  const tokenInAddr = getToken(args.tokenIn, chainId).native
    ? "0x0000000000000000000000000000000000000000"
    : getToken(args.tokenIn, chainId).address;
  const zeroForOne = tokenInAddr.toLowerCase() === key.currency0.toLowerCase();

  try {
    const { result } = await getRpcClient(chainId).simulateContract({
      address: getV4StackForHook(key.hooks).quoter,
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
  /** Target chain — picks the right PoolSwapTest deployment. */
  chainId?: SupportedTestnetChainId;
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
  const poolSwapTest = getV4StackForHook(args.poolKey.hooks).poolSwapTest;
  if (!poolSwapTest) {
    throw new Error("PoolSwapTest is not deployed for this pool's hook stack");
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
    to: poolSwapTest,
    data,
    value: isNativeIn ? args.amountInRaw.toString() : "0",
    approvalTarget: isNativeIn ? null : poolSwapTest,
  };
}

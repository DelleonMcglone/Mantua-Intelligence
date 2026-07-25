import { createWalletClient, http, erc20Abi, encodeFunctionData, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { env } from "../env.ts";
import { logger } from "./logger.ts";
import { baseRpcClient } from "./rpc-client.ts";
import { buildPoolKey } from "./pool-key.ts";
import { computePoolId } from "./pool-id.ts";
import { readSlot0 } from "./v4-state-view.ts";
import { getToken } from "./tokens.ts";
import { getHookAddress, HOOK_DEPLOYMENTS_ARC, POOL_SWAP_TEST_ABI } from "./v4-contracts.ts";
import { getUsdPrice } from "./usd-pricing.ts";
import { getLiquidityForAmounts } from "./liquidity-math.ts";
import { getMinUsableTick, getMaxUsableTick, getSqrtRatioAtTick } from "./tick-math.ts";

/**
 * TEMPORARY maintenance: repair the DynamicFee USDC/cirBTC pools on the
 * hook's own PoolManager (they were initialized at nonsense prices and never
 * seeded, so every UI quote returns dust — see the 2026-07 session notes).
 *
 *  - fee 500 (the tier the UI requests): re-price to the live market rate
 *    with a price-limited swap (sells cirBTC; the pool overpays for it, and
 *    the limit makes the pool stop exactly at market), then seed full-range
 *    liquidity through the stack's PoolModifyLiquidityTest router.
 *  - fee 3000: zero liquidity, so a 1-wei price-limited swap snaps the price
 *    to market for free. Left unseeded — fee 500 is the served tier.
 *
 * Signed by the hook-owner admin EOA (MANTUA_ADMIN_PRIVATE_KEY), which only
 * exists in the deployed environment — hence the cron-secret-gated route
 * instead of a local script. Idempotent: within-tolerance pools are skipped,
 * so repeat invocations are safe. Remove route + lib once the repair has run.
 */

const EXPECTED_ADMIN = "0xceed79dbb39ba3c6cddb57eb6343be25ffd6dd56";
const DF = HOOK_DEPLOYMENTS_ARC["dynamic-fee"];
const MAX_UINT256 = 2n ** 256n - 1n;
/** Skip re-pricing when the pool is within this many percent of market. */
const PRICE_TOLERANCE_PCT = 1;
/** Skip seeding when in-range liquidity already exceeds this. */
const MIN_SEEDED_LIQUIDITY = 1_000_000n;
/** Seed budget — admin holds ~0.0107 cirBTC and ~1500 USDC. */
const SEED_CIRBTC = "0.008";
const SEED_USDC_MAX = "520";
/** Max cirBTC spent walking the fee-500 price up through dust liquidity. */
const REPRICE_CIRBTC_MAX = "0.002";

const STATE_VIEW_LIQUIDITY_ABI = [
  {
    type: "function",
    name: "getLiquidity",
    stateMutability: "view",
    inputs: [{ type: "bytes32", name: "poolId" }],
    outputs: [{ type: "uint128" }],
  },
] as const;

const MODIFY_LIQ_ABI = [
  {
    type: "function",
    name: "modifyLiquidity",
    stateMutability: "payable",
    inputs: [
      {
        type: "tuple",
        name: "key",
        components: [
          { type: "address", name: "currency0" },
          { type: "address", name: "currency1" },
          { type: "uint24", name: "fee" },
          { type: "int24", name: "tickSpacing" },
          { type: "address", name: "hooks" },
        ],
      },
      {
        type: "tuple",
        name: "params",
        components: [
          { type: "int24", name: "tickLower" },
          { type: "int24", name: "tickUpper" },
          { type: "int256", name: "liquidityDelta" },
          { type: "bytes32", name: "salt" },
        ],
      },
      { type: "bytes", name: "hookData" },
    ],
    outputs: [{ type: "int256" }],
  },
] as const;

export class DfRepairUnavailableError extends Error {
  constructor() {
    super("DynamicFee repair is not configured (MANTUA_ADMIN_PRIVATE_KEY unset).");
    this.name = "DfRepairUnavailableError";
  }
}

export interface DfRepairResult {
  signer: string;
  marketPrice: number;
  steps: { step: string; txHash?: string; skipped?: string }[];
  fee500PriceAfter: number | null;
  fee3000PriceAfter: number | null;
}

/** sqrt(market raw token1/token0 price) in X96, from USD prices. */
function sqrtX96(p0usd: number, p1usd: number, d0: number, d1: number): bigint {
  const raw = (p0usd / p1usd) * 10 ** (d1 - d0);
  return BigInt(Math.round(Math.sqrt(raw) * 2 ** 48)) << 48n;
}

function humanPrice(sqrtPriceX96: bigint, d0: number, d1: number): number {
  const r = Number(sqrtPriceX96) / 2 ** 96;
  return r * r * 10 ** (d0 - d1);
}

export async function repairDynamicFeePools(): Promise<DfRepairResult> {
  // The funded admin EOA (0xceed…dd56) is X402_BUYER_PRIVATE_KEY in prod;
  // MANTUA_ADMIN_PRIVATE_KEY is a different keeper EOA. Accept whichever
  // env key resolves to the expected address.
  const candidates = [env.X402_BUYER_PRIVATE_KEY, env.MANTUA_ADMIN_PRIVATE_KEY].filter(
    (k): k is string => Boolean(k),
  );
  if (candidates.length === 0) throw new DfRepairUnavailableError();
  const accounts = candidates.map((k) => privateKeyToAccount(k as `0x${string}`));
  const matched = accounts.find((a) => a.address.toLowerCase() === EXPECTED_ADMIN);
  if (!matched) {
    const found = accounts.map((a) => a.address).join(", ");
    throw new Error(`no configured key resolves to admin ${EXPECTED_ADMIN} (found: ${found})`);
  }
  const account = matched;
  const wallet = createWalletClient({ account, chain: arcTestnet, transport: http() });
  const hook = getHookAddress("dynamic-fee");
  if (!hook || !DF.poolSwapTest || !DF.poolModifyLiquidityTest || !DF.stateView) {
    throw new Error("DynamicFee stack is not fully deployed");
  }
  const dfStateView = DF.stateView;

  const usdc = getToken("USDC");
  const cir = getToken("cirBTC");
  const [pU, pB] = await Promise.all([getUsdPrice("USDC"), getUsdPrice("cirBTC")]);
  if (!pU || !pB) throw new Error("market prices unavailable");
  const target = sqrtX96(pU, pB, usdc.decimals, cir.decimals);
  const marketPrice = humanPrice(target, usdc.decimals, cir.decimals);
  const steps: DfRepairResult["steps"] = [];

  async function sendAndWait(step: string, to: `0x${string}`, data: `0x${string}`) {
    // Dry-run first so a revert surfaces as a clean error, not a burned tx.
    await baseRpcClient.call({ to, data, account: account.address });
    const txHash = await wallet.sendTransaction({ to, data });
    const rcpt = await baseRpcClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
    if (rcpt.status !== "success") throw new Error(`${step} reverted (${txHash})`);
    steps.push({ step, txHash });
    logger.info({ step, txHash }, "df-repair step complete");
  }

  async function ensureApproval(token: `0x${string}`, spender: `0x${string}`, label: string) {
    const cur = await baseRpcClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, spender],
    });
    if (cur > MAX_UINT256 / 2n) return;
    await sendAndWait(
      `approve:${label}`,
      token,
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, MAX_UINT256],
      }),
    );
  }

  function priceLimitedSwapData(
    pk: ReturnType<typeof buildPoolKey>["key"],
    zeroForOne: boolean,
    amountInRaw: bigint,
  ): `0x${string}` {
    return encodeFunctionData({
      abi: POOL_SWAP_TEST_ABI,
      functionName: "swap",
      args: [
        pk,
        { zeroForOne, amountSpecified: -amountInRaw, sqrtPriceLimitX96: target },
        { takeClaims: false, settleUsingBurn: false },
        "0x",
      ],
    });
  }

  // ---- fee 500: re-price, then seed ----
  const { key: pk500 } = buildPoolKey("USDC", "cirBTC", 500, hook, "dynamic-fee");
  {
    const slot0 = await readSlot0(pk500);
    if (!slot0) throw new Error("fee-500 pool not initialized");
    const cur = humanPrice(slot0.sqrtPriceX96, usdc.decimals, cir.decimals);
    const devPct = Math.abs(((cur - marketPrice) / marketPrice) * 100);
    if (devPct <= PRICE_TOLERANCE_PCT) {
      steps.push({ step: "reprice:fee500", skipped: `within ${String(PRICE_TOLERANCE_PCT)}%` });
    } else {
      const zeroForOne = slot0.sqrtPriceX96 > target;
      const sellTok = zeroForOne ? usdc : cir;
      const maxIn = zeroForOne
        ? parseUnits(SEED_USDC_MAX, usdc.decimals)
        : parseUnits(REPRICE_CIRBTC_MAX, cir.decimals);
      await ensureApproval(sellTok.address, DF.poolSwapTest, `${sellTok.symbol}->swapRouter`);
      await sendAndWait(
        "reprice:fee500",
        DF.poolSwapTest,
        priceLimitedSwapData(pk500, zeroForOne, maxIn),
      );
    }

    const liquidity = await baseRpcClient.readContract({
      address: dfStateView,
      abi: STATE_VIEW_LIQUIDITY_ABI,
      functionName: "getLiquidity",
      args: [computePoolId(pk500)],
    });
    if (liquidity >= MIN_SEEDED_LIQUIDITY) {
      steps.push({
        step: "seed:fee500",
        skipped: `liquidity ${liquidity.toString()} already present`,
      });
    } else {
      await ensureApproval(usdc.address, DF.poolModifyLiquidityTest, "USDC->liqRouter");
      await ensureApproval(cir.address, DF.poolModifyLiquidityTest, "cirBTC->liqRouter");
      const seeded = await readSlot0(pk500);
      if (!seeded) throw new Error("fee-500 slot0 unreadable after reprice");
      const tickLower = getMinUsableTick(pk500.tickSpacing);
      const tickUpper = getMaxUsableTick(pk500.tickSpacing);
      const liq = getLiquidityForAmounts({
        sqrtPriceCurrentX96: seeded.sqrtPriceX96,
        sqrtPriceLowerX96: getSqrtRatioAtTick(tickLower),
        sqrtPriceUpperX96: getSqrtRatioAtTick(tickUpper),
        amount0: parseUnits(SEED_USDC_MAX, usdc.decimals),
        amount1: parseUnits(SEED_CIRBTC, cir.decimals),
      });
      if (liq === 0n) throw new Error("computed seed liquidity is zero");
      const liqData = encodeFunctionData({
        abi: MODIFY_LIQ_ABI,
        functionName: "modifyLiquidity",
        args: [
          pk500,
          { tickLower, tickUpper, liquidityDelta: liq, salt: `0x${"0".repeat(64)}` },
          "0x",
        ],
      });
      await sendAndWait("seed:fee500", DF.poolModifyLiquidityTest, liqData);
    }
  }

  // ---- fee 3000: free price snap (zero-liquidity pool) ----
  const { key: pk3000 } = buildPoolKey("USDC", "cirBTC", 3000, hook, "dynamic-fee");
  {
    const slot0 = await readSlot0(pk3000);
    if (!slot0) {
      steps.push({ step: "snap:fee3000", skipped: "not initialized" });
    } else {
      const cur = humanPrice(slot0.sqrtPriceX96, usdc.decimals, cir.decimals);
      const devPct = Math.abs(((cur - marketPrice) / marketPrice) * 100);
      if (devPct <= PRICE_TOLERANCE_PCT) {
        steps.push({ step: "snap:fee3000", skipped: `within ${String(PRICE_TOLERANCE_PCT)}%` });
      } else {
        const zeroForOne = slot0.sqrtPriceX96 > target;
        const sellTok = zeroForOne ? usdc : cir;
        await ensureApproval(sellTok.address, DF.poolSwapTest, `${sellTok.symbol}->swapRouter`);
        await sendAndWait(
          "snap:fee3000",
          DF.poolSwapTest,
          priceLimitedSwapData(pk3000, zeroForOne, 1n),
        );
      }
    }
  }

  const [after500, after3000] = await Promise.all([readSlot0(pk500), readSlot0(pk3000)]);
  return {
    signer: account.address,
    marketPrice,
    steps,
    fee500PriceAfter: after500
      ? humanPrice(after500.sqrtPriceX96, usdc.decimals, cir.decimals)
      : null,
    fee3000PriceAfter: after3000
      ? humanPrice(after3000.sqrtPriceX96, usdc.decimals, cir.decimals)
      : null,
  };
}

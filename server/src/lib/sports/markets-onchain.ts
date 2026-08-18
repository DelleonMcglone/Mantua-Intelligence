/**
 * The on-chain half of the market lifecycle: creation via the MarketFactory
 * and settlement via the Resolver, signed with `MARKET_SIGNER_PRIVATE_KEY`
 * (the Resolver's authorised signer).
 *
 * Kept deliberately thin: everything decidable is decided in the pure
 * planners (`planMarkets`, `planResolution`) that already have their own
 * tests — this module only turns decisions into transactions. Every write
 * simulates first so a revert surfaces as a per-item failure instead of
 * burning gas, matching `executeResolution`'s isolation contract.
 */

import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { env } from "../../env.ts";
import { logger } from "../logger.ts";
import { baseRpcClient } from "../rpc-client.ts";
import {
  ERC20_APPROVE_ABI,
  LP_ROUTER_ABI,
  MARKETS_ARC,
  MARKETS_PERIPHERY_ARC,
  MARKET_ABI,
  MARKET_FACTORY_ABI,
  MARKET_SPLIT_ABI,
  POOL_MANAGER_INIT_ABI,
  REGISTRY_ABI,
  RESOLVER_CONTRACT_ABI,
  STATE_VIEW_ABI,
} from "../markets-contracts.ts";
import { DYNAMIC_MARKET_ARC } from "../v4-contracts.ts";
import { planMarketPool } from "./market-pool.ts";
import type { PlannedMarket } from "./ingest.ts";
import type { ResolutionPlan, ResolutionSubmitter } from "./resolution.ts";

/** Null when no signer key is configured — callers degrade to planning. */
export function marketSignerWallet() {
  const key = env.MARKET_SIGNER_PRIVATE_KEY;
  if (!key) return null;
  const account = privateKeyToAccount(key as `0x${string}`);
  return createWalletClient({ account, chain: arcTestnet, transport: http(env.ARC_RPC_URL) });
}

/**
 * The markets worth submitting: `createMarketIfAbsent` reverts StartInPast,
 * so games at/past kickoff are filtered here — they missed their window and
 * simply never get a market. Pure, for tests.
 */
export function creatableMarkets(
  planned: readonly PlannedMarket[],
  nowSeconds: number = Math.floor(Date.now() / 1000),
): PlannedMarket[] {
  return planned.filter((m) => m.kickoffTimestamp > nowSeconds);
}

export interface MarketCreationSummary {
  submitted: number;
  created: number;
  existed: number;
  skippedPastKickoff: number;
  poolsOpened: number;
  poolsSeeded: number;
  failures: { marketId: string; error: string }[];
}

/** Four-hour window mirrors the test harness; resolution can run later —
 *  the registry timestamp only drives the hook's near-resolution premium. */
const RESOLUTION_WINDOW_SECONDS = 4 * 3600;

/** Wide range straddling most opening odds (p ≈ 0.09–0.91); multiple of
 *  the 60 tick spacing. Outside it a seed goes single-sided, which the
 *  conservative L sizing below still affords. */
const SEED_TICK = 11_520;

async function writeAndWait(
  wallet: NonNullable<ReturnType<typeof marketSignerWallet>>,
  request: unknown,
): Promise<void> {
  const tx = await wallet.writeContract(request as never);
  await baseRpcClient.waitForTransactionReceipt({ hash: tx });
}

/**
 * Seed a freshly opened pool with a sliver of protocol liquidity so the
 * market is actually tradeable at its opening odds — a pool with a price
 * but no liquidity fills nothing. The signer splits MARKET_SEED_USDC into
 * a full YES/NO set and LPs the YES side with USDC across a wide range.
 * L = seed/3 keeps the worst-case single-sided requirement under the
 * split amount at any clamped opening probability. Idempotent by the
 * liquidity check: already-seeded pools are skipped.
 */
async function seedPoolLiquidity(
  wallet: NonNullable<ReturnType<typeof marketSignerWallet>>,
  marketAddress: `0x${string}`,
  plan: ReturnType<typeof planMarketPool>,
): Promise<boolean> {
  const seed = BigInt(env.MARKET_SEED_USDC);
  if (seed === 0n) return false;

  const liquidity = await baseRpcClient.readContract({
    address: MARKETS_PERIPHERY_ARC.stateView,
    abi: STATE_VIEW_ABI,
    functionName: "getLiquidity",
    args: [plan.poolId],
  });
  if (liquidity > 0n) return false;

  const approveThenCall = async (token: `0x${string}`, spender: `0x${string}`, amount: bigint) => {
    const { request } = await baseRpcClient.simulateContract({
      account: wallet.account,
      address: token,
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [spender, amount],
    });
    await writeAndWait(wallet, request);
  };

  // 1. Split seed USDC into YES + NO (NO stays with the signer; only the
  //    YES/USDC pool exists — DM-101's complementary market covers NO).
  await approveThenCall(MARKETS_ARC.collateral, marketAddress, seed);
  const { request: splitReq } = await baseRpcClient.simulateContract({
    account: wallet.account,
    address: marketAddress,
    abi: MARKET_SPLIT_ABI,
    functionName: "split",
    args: [seed],
  });
  await writeAndWait(wallet, splitReq);

  // 2. LP: approve both sides to the liquidity router and add.
  const yesToken = plan.yesIsToken0 ? plan.key.currency0 : plan.key.currency1;
  await approveThenCall(yesToken, MARKETS_PERIPHERY_ARC.poolModifyLiquidityTest, seed);
  await approveThenCall(
    MARKETS_ARC.collateral,
    MARKETS_PERIPHERY_ARC.poolModifyLiquidityTest,
    seed,
  );
  const { request: lpReq } = await baseRpcClient.simulateContract({
    account: wallet.account,
    address: MARKETS_PERIPHERY_ARC.poolModifyLiquidityTest,
    abi: LP_ROUTER_ABI,
    functionName: "modifyLiquidity",
    args: [
      plan.key,
      {
        tickLower: -SEED_TICK,
        tickUpper: SEED_TICK,
        liquidityDelta: seed / 3n,
        salt: `0x${"00".repeat(32)}`,
      },
      "0x",
    ],
  });
  await writeAndWait(wallet, lpReq);
  return true;
}

/**
 * B1-009 — open the market's YES/USDC pool at the provider's implied
 * probability. Idempotent: an already-registered pool is skipped, an
 * already-initialized pool surfaces as a simulate revert and is treated as
 * done. Register-then-initialize order matters — the hook's beforeInitialize
 * consults the registry.
 */
async function bootstrapMarketPool(
  wallet: NonNullable<ReturnType<typeof marketSignerWallet>>,
  marketAddress: `0x${string}`,
  m: PlannedMarket,
): Promise<{ opened: boolean; plan: ReturnType<typeof planMarketPool> }> {
  const yesToken = await baseRpcClient.readContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "yesToken",
  });
  const plan = planMarketPool(
    yesToken,
    MARKETS_ARC.collateral,
    DYNAMIC_MARKET_ARC.hook,
    m.openingProbability,
  );

  const registered = await baseRpcClient.readContract({
    address: DYNAMIC_MARKET_ARC.registry,
    abi: REGISTRY_ABI,
    functionName: "isRegistered",
    args: [plan.poolId],
  });
  if (!registered) {
    const { request } = await baseRpcClient.simulateContract({
      account: wallet.account,
      address: DYNAMIC_MARKET_ARC.registry,
      abi: REGISTRY_ABI,
      functionName: "registerPool",
      args: [
        plan.poolId,
        BigInt(m.kickoffTimestamp),
        BigInt(m.kickoffTimestamp + RESOLUTION_WINDOW_SECONDS),
        plan.yesIsToken0,
        6,
      ],
    });
    const tx = await wallet.writeContract(request);
    await baseRpcClient.waitForTransactionReceipt({ hash: tx });
  }

  try {
    const { request } = await baseRpcClient.simulateContract({
      account: wallet.account,
      address: DYNAMIC_MARKET_ARC.poolManager,
      abi: POOL_MANAGER_INIT_ABI,
      functionName: "initialize",
      args: [plan.key, plan.sqrtPriceX96],
    });
    const tx = await wallet.writeContract(request);
    await baseRpcClient.waitForTransactionReceipt({ hash: tx });
    logger.info(
      { marketId: m.marketId, poolId: plan.poolId, probability: m.openingProbability },
      "markets: pool opened at implied probability",
    );
    return { opened: true, plan };
  } catch {
    // Already initialized — a previous half-completed run; done is done.
    return { opened: false, plan };
  }
}

/**
 * Idempotent on-chain sweep: one `createMarketIfAbsent` per planned market.
 * The factory's absent-check makes re-runs free of duplicates, so this can
 * ride every sports-sync tick.
 */
export async function createMarketsOnChain(
  planned: readonly PlannedMarket[],
): Promise<MarketCreationSummary | null> {
  const wallet = marketSignerWallet();
  if (!wallet) return null;

  const now = Math.floor(Date.now() / 1000);
  const todo = creatableMarkets(planned, now);
  const summary: MarketCreationSummary = {
    submitted: 0,
    created: 0,
    existed: 0,
    skippedPastKickoff: planned.length - todo.length,
    poolsOpened: 0,
    poolsSeeded: 0,
    failures: [],
  };

  for (const m of todo) {
    try {
      let marketAddress = await baseRpcClient.readContract({
        address: MARKETS_ARC.factory,
        abi: MARKET_FACTORY_ABI,
        functionName: "marketOf",
        args: [m.marketId],
      });
      if (marketAddress !== "0x0000000000000000000000000000000000000000") {
        summary.existed += 1;
      } else {
        const { request } = await baseRpcClient.simulateContract({
          account: wallet.account,
          address: MARKETS_ARC.factory,
          abi: MARKET_FACTORY_ABI,
          functionName: "createMarketIfAbsent",
          args: [m.marketId, BigInt(m.kickoffTimestamp), m.label],
        });
        const txHash = await wallet.writeContract(request);
        await baseRpcClient.waitForTransactionReceipt({ hash: txHash });
        marketAddress = await baseRpcClient.readContract({
          address: MARKETS_ARC.factory,
          abi: MARKET_FACTORY_ABI,
          functionName: "marketOf",
          args: [m.marketId],
        });
        summary.submitted += 1;
        summary.created += 1;
        logger.info({ marketId: m.marketId, label: m.label, txHash }, "markets: created on-chain");
      }
      // Pool bootstrap + seed run for existing markets too — a
      // half-completed earlier sweep heals on the next tick.
      const boot = await bootstrapMarketPool(wallet, marketAddress, m);
      if (boot.opened) summary.poolsOpened += 1;
      if (await seedPoolLiquidity(wallet, marketAddress, boot.plan)) summary.poolsSeeded += 1;
    } catch (err) {
      summary.failures.push({
        marketId: m.marketId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return summary;
}

/**
 * The live `ResolutionSubmitter` against the deployed Resolver, or null
 * without a signer. Freeze treats a revert as "already done" per the port's
 * contract (idempotent sweep); resolve/void simulate first so a revert is a
 * clean per-market failure for `executeResolution` to isolate.
 */
export function liveResolutionSubmitter(): ResolutionSubmitter | null {
  const wallet = marketSignerWallet();
  if (!wallet) return null;

  const write = async (
    functionName: "freeze" | "resolve" | "voidMarket",
    args: readonly unknown[],
  ): Promise<string> => {
    const { request } = await baseRpcClient.simulateContract({
      account: wallet.account,
      address: MARKETS_ARC.resolver,
      abi: RESOLVER_CONTRACT_ABI,
      functionName,
      // viem's tuple-typed args don't unify across the three overloads here.
      args: args as never,
    });
    const txHash = await wallet.writeContract(request);
    await baseRpcClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  };

  return {
    signerAddress: () => wallet.account.address,
    async freeze(marketId) {
      try {
        return await write("freeze", [marketId]);
      } catch {
        // Already frozen / not yet due / already resolved — the sweep is
        // idempotent and a no-op freeze is success, not an error.
        return null;
      }
    },
    resolve: (marketId, outcome) => write("resolve", [marketId, outcome]),
    void: (marketId) => write("voidMarket", [marketId]),
  };
}

/**
 * Restrict a resolution plan to markets that exist on-chain. Games finished
 * before market creation went live (or whose creation failed) plan resolves
 * for markets that were never minted; submitting those burns an RPC
 * simulation per market per tick and reports as failures. `marketOf` reads
 * batch through the client's multicall, so this is one call, not N.
 */
export async function filterPlanToExistingMarkets(plan: ResolutionPlan): Promise<ResolutionPlan> {
  const ids = [...new Set([...plan.freezes, ...plan.submissions.map((s) => s.marketId)])];
  if (ids.length === 0) return plan;

  const exists = new Map<string, boolean>();
  await Promise.all(
    ids.map(async (id) => {
      const addr = await baseRpcClient.readContract({
        address: MARKETS_ARC.factory,
        abi: MARKET_FACTORY_ABI,
        functionName: "marketOf",
        args: [id],
      });
      exists.set(id, addr !== "0x0000000000000000000000000000000000000000");
    }),
  );

  return {
    freezes: plan.freezes.filter((id) => exists.get(id)),
    submissions: plan.submissions.filter((s) => exists.get(s.marketId)),
    held: plan.held,
  };
}

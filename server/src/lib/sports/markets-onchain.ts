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
import { arcTestnet, baseSepolia } from "viem/chains";
import { env } from "../../env.ts";
import { ARC_TESTNET_CHAIN_ID, type SupportedTestnetChainId } from "../chains.ts";
import { logger } from "../logger.ts";
import { getRpcClient } from "../rpc-client.ts";
import {
  ERC20_APPROVE_ABI,
  LP_ROUTER_ABI,
  MARKETS_BY_CHAIN,
  MARKETS_PERIPHERY_BY_CHAIN,
  MARKET_ABI,
  MARKET_FACTORY_ABI,
  MARKET_SPLIT_ABI,
  POOL_MANAGER_INIT_ABI,
  REGISTRY_ABI,
  RESOLVER_CONTRACT_ABI,
  STATE_VIEW_ABI,
} from "../markets-contracts.ts";
import { DYNAMIC_MARKET_BY_CHAIN } from "../v4-contracts.ts";
import { planMarketPool } from "./market-pool.ts";
import type { PlannedMarket } from "./ingest.ts";
import type { ResolutionPlan, ResolutionSubmitter } from "./resolution.ts";

/** Null when no configured key derives to the chain's authorised operator —
 *  callers degrade to planning.
 *
 *  Keys are routed by DERIVED ADDRESS, not by which env var holds them: a
 *  key signs on a chain only if it is that chain's Resolver-authorised
 *  operator (`DYNAMIC_MARKET_BY_CHAIN[chainId].operator`). This guard is
 *  load-bearing: on 2026-08-20 the Base operator key was pasted over
 *  MARKET_SIGNER_PRIVATE_KEY (the Arc var), and the sweep then spent three
 *  days signing Arc transactions from an account with zero Arc balance —
 *  every market creation failed and no game got a market on any chain.
 *  Address routing makes a mislabeled var self-heal (the key still signs on
 *  the chain it is authorised for) instead of silently signing on the wrong
 *  chain, and a key matching no chain is refused loudly. */
export function marketSignerWallet(chainId: SupportedTestnetChainId = ARC_TESTNET_CHAIN_ID) {
  const operator = DYNAMIC_MARKET_BY_CHAIN[chainId]?.operator.toLowerCase();
  if (!operator) return null;
  const candidates = [env.MARKET_SIGNER_PRIVATE_KEY, env.BASE_MARKET_SIGNER_PRIVATE_KEY];
  for (const key of candidates) {
    if (!key) continue;
    const account = privateKeyToAccount(key as `0x${string}`);
    if (account.address.toLowerCase() !== operator) continue;
    return chainId === ARC_TESTNET_CHAIN_ID
      ? createWalletClient({ account, chain: arcTestnet, transport: http(env.ARC_RPC_URL) })
      : createWalletClient({
          account,
          chain: baseSepolia,
          transport: http(env.BASE_SEPOLIA_RPC_URL),
        });
  }
  logger.warn(
    { chainId, operator },
    "markets: no configured signer key derives to this chain's operator — degrading to planning",
  );
  return null;
}

/** The chain's markets/periphery/dynamic-market config, or throw. */
function marketsCfg(chainId: SupportedTestnetChainId) {
  const markets = MARKETS_BY_CHAIN[chainId];
  const periphery = MARKETS_PERIPHERY_BY_CHAIN[chainId];
  const dm = DYNAMIC_MARKET_BY_CHAIN[chainId];
  if (!markets || !periphery || !dm) {
    throw new Error(`Sports markets are not deployed on chain ${String(chainId)}`);
  }
  return { markets, periphery, dm };
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

export interface OnChainMarketDetail {
  marketId: `0x${string}`;
  providerEventId: string;
  outcomeIndex: number;
  marketAddress: `0x${string}`;
  yesToken: `0x${string}`;
  noToken: `0x${string}`;
  poolId: `0x${string}`;
  openingProbability: number;
}

export interface MarketCreationSummary {
  submitted: number;
  created: number;
  existed: number;
  skippedPastKickoff: number;
  poolsOpened: number;
  poolsSeeded: number;
  /** Every market this sweep touched, for DB persistence — the resolutions
   *  log FK-requires a markets row, so rows must exist before settlement. */
  details: OnChainMarketDetail[];
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
  chainId: SupportedTestnetChainId,
): Promise<void> {
  const tx = await wallet.writeContract(request as never);
  await getRpcClient(chainId).waitForTransactionReceipt({ hash: tx });
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
  chainId: SupportedTestnetChainId,
): Promise<boolean> {
  const seed = BigInt(env.MARKET_SEED_USDC);
  if (seed === 0n) return false;
  const cfg = marketsCfg(chainId);
  const client = getRpcClient(chainId);

  const liquidity = await client.readContract({
    address: cfg.periphery.stateView,
    abi: STATE_VIEW_ABI,
    functionName: "getLiquidity",
    args: [plan.poolId],
  });
  if (liquidity > 0n) return false;

  const approveThenCall = async (token: `0x${string}`, spender: `0x${string}`, amount: bigint) => {
    const { request } = await client.simulateContract({
      account: wallet.account,
      address: token,
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [spender, amount],
    });
    await writeAndWait(wallet, request, chainId);
  };

  // 1. Split seed USDC into YES + NO (NO stays with the signer; only the
  //    YES/USDC pool exists — DM-101's complementary market covers NO).
  await approveThenCall(cfg.markets.collateral, marketAddress, seed);
  const { request: splitReq } = await client.simulateContract({
    account: wallet.account,
    address: marketAddress,
    abi: MARKET_SPLIT_ABI,
    functionName: "split",
    args: [seed],
  });
  await writeAndWait(wallet, splitReq, chainId);

  // 2. LP: approve both sides to the liquidity router and add.
  const yesToken = plan.yesIsToken0 ? plan.key.currency0 : plan.key.currency1;
  await approveThenCall(yesToken, cfg.periphery.poolModifyLiquidityTest, seed);
  await approveThenCall(cfg.markets.collateral, cfg.periphery.poolModifyLiquidityTest, seed);
  const { request: lpReq } = await client.simulateContract({
    account: wallet.account,
    address: cfg.periphery.poolModifyLiquidityTest,
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
  await writeAndWait(wallet, lpReq, chainId);
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
  chainId: SupportedTestnetChainId,
): Promise<{
  opened: boolean;
  plan: ReturnType<typeof planMarketPool>;
  yesToken: `0x${string}`;
  noToken: `0x${string}`;
}> {
  const cfg = marketsCfg(chainId);
  const client = getRpcClient(chainId);
  const yesToken = await client.readContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "yesToken",
  });
  const noToken = await client.readContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "noToken",
  });
  const plan = planMarketPool(yesToken, cfg.markets.collateral, cfg.dm.hook, m.openingProbability);

  const registered = await client.readContract({
    address: cfg.dm.registry,
    abi: REGISTRY_ABI,
    functionName: "isRegistered",
    args: [plan.poolId],
  });
  if (!registered) {
    const { request } = await client.simulateContract({
      account: wallet.account,
      address: cfg.dm.registry,
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
    await client.waitForTransactionReceipt({ hash: tx });
  }

  try {
    const { request } = await client.simulateContract({
      account: wallet.account,
      address: cfg.dm.poolManager,
      abi: POOL_MANAGER_INIT_ABI,
      functionName: "initialize",
      args: [plan.key, plan.sqrtPriceX96],
    });
    const tx = await wallet.writeContract(request);
    await client.waitForTransactionReceipt({ hash: tx });
    logger.info(
      { marketId: m.marketId, poolId: plan.poolId, probability: m.openingProbability },
      "markets: pool opened at implied probability",
    );
    return { opened: true, plan, yesToken, noToken };
  } catch {
    // Already initialized — a previous half-completed run; done is done.
    return { opened: false, plan, yesToken, noToken };
  }
}

/**
 * Idempotent on-chain sweep: one `createMarketIfAbsent` per planned market.
 * The factory's absent-check makes re-runs free of duplicates, so this can
 * ride every sports-sync tick.
 */
export async function createMarketsOnChain(
  planned: readonly PlannedMarket[],
  chainId: SupportedTestnetChainId = ARC_TESTNET_CHAIN_ID,
): Promise<MarketCreationSummary | null> {
  const wallet = marketSignerWallet(chainId);
  if (!wallet) return null;
  const cfg = marketsCfg(chainId);
  const client = getRpcClient(chainId);

  const now = Math.floor(Date.now() / 1000);
  const todo = creatableMarkets(planned, now);
  const summary: MarketCreationSummary = {
    submitted: 0,
    created: 0,
    existed: 0,
    skippedPastKickoff: planned.length - todo.length,
    poolsOpened: 0,
    poolsSeeded: 0,
    details: [],
    failures: [],
  };

  for (const m of todo) {
    try {
      let marketAddress = await client.readContract({
        address: cfg.markets.factory,
        abi: MARKET_FACTORY_ABI,
        functionName: "marketOf",
        args: [m.marketId],
      });
      if (marketAddress !== "0x0000000000000000000000000000000000000000") {
        summary.existed += 1;
      } else {
        const { request } = await client.simulateContract({
          account: wallet.account,
          address: cfg.markets.factory,
          abi: MARKET_FACTORY_ABI,
          functionName: "createMarketIfAbsent",
          args: [m.marketId, BigInt(m.kickoffTimestamp), m.label],
        });
        const txHash = await wallet.writeContract(request);
        await client.waitForTransactionReceipt({ hash: txHash });
        marketAddress = await client.readContract({
          address: cfg.markets.factory,
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
      const boot = await bootstrapMarketPool(wallet, marketAddress, m, chainId);
      if (boot.opened) summary.poolsOpened += 1;
      if (await seedPoolLiquidity(wallet, marketAddress, boot.plan, chainId)) {
        summary.poolsSeeded += 1;
      }
      summary.details.push({
        marketId: m.marketId,
        providerEventId: m.providerEventId,
        outcomeIndex: m.outcomeIndex,
        marketAddress,
        yesToken: boot.yesToken,
        noToken: boot.noToken,
        poolId: boot.plan.poolId,
        openingProbability: m.openingProbability,
      });
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
export function liveResolutionSubmitter(
  chainId: SupportedTestnetChainId = ARC_TESTNET_CHAIN_ID,
): ResolutionSubmitter | null {
  const wallet = marketSignerWallet(chainId);
  if (!wallet) return null;
  const cfg = marketsCfg(chainId);
  const client = getRpcClient(chainId);

  const write = async (
    functionName: "freeze" | "resolve" | "voidMarket",
    args: readonly unknown[],
  ): Promise<string> => {
    const { request } = await client.simulateContract({
      account: wallet.account,
      address: cfg.markets.resolver,
      abi: RESOLVER_CONTRACT_ABI,
      functionName,
      // viem's tuple-typed args don't unify across the three overloads here.
      args: args as never,
    });
    const txHash = await wallet.writeContract(request);
    await client.waitForTransactionReceipt({ hash: txHash });
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
export async function filterPlanToExistingMarkets(
  plan: ResolutionPlan,
  chainId: SupportedTestnetChainId = ARC_TESTNET_CHAIN_ID,
): Promise<ResolutionPlan> {
  const ids = [...new Set([...plan.freezes, ...plan.submissions.map((s) => s.marketId)])];
  if (ids.length === 0) return plan;
  const cfg = marketsCfg(chainId);
  const client = getRpcClient(chainId);

  const exists = new Map<string, boolean>();
  await Promise.all(
    ids.map(async (id) => {
      const addr = await client.readContract({
        address: cfg.markets.factory,
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

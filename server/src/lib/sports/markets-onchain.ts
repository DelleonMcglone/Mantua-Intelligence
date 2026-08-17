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
import { MARKETS_ARC, MARKET_FACTORY_ABI, RESOLVER_CONTRACT_ABI } from "../markets-contracts.ts";
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
  failures: { marketId: string; error: string }[];
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
    failures: [],
  };

  for (const m of todo) {
    try {
      const existing = await baseRpcClient.readContract({
        address: MARKETS_ARC.factory,
        abi: MARKET_FACTORY_ABI,
        functionName: "marketOf",
        args: [m.marketId],
      });
      if (existing !== "0x0000000000000000000000000000000000000000") {
        summary.existed += 1;
        continue;
      }
      const { request } = await baseRpcClient.simulateContract({
        account: wallet.account,
        address: MARKETS_ARC.factory,
        abi: MARKET_FACTORY_ABI,
        functionName: "createMarketIfAbsent",
        args: [m.marketId, BigInt(m.kickoffTimestamp), m.label],
      });
      const txHash = await wallet.writeContract(request);
      await baseRpcClient.waitForTransactionReceipt({ hash: txHash });
      summary.submitted += 1;
      summary.created += 1;
      logger.info({ marketId: m.marketId, label: m.label, txHash }, "markets: created on-chain");
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

import { createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { env } from "../env.ts";
import { logger } from "./logger.ts";
import { getPythPrice, PYTH_EUR_USD_FEED_ID } from "./pyth-prices.ts";
import { buildPoolKey } from "./pool-key.ts";
import { computePoolId } from "./pool-id.ts";
import { HOOK_DEPLOYMENTS_ARC } from "./v4-contracts.ts";
import { DEFAULT_CHAIN_ID } from "./chains.ts";

/**
 * Peg-reference keeper for the FX-aware Stable Protection hook.
 *
 * The hook measures depeg against a per-pool EUR/USD reference (see the hook's
 * `setPegReference`). This reads the live EUR/USD from Pyth Hermes (the same
 * source as our price layer) and pushes it on-chain via the owner EOA, so the
 * USDC/EURC pool at the true ~1.14 rate reads HEALTHY instead of tripping the
 * breaker. Runs on a daily cron; EUR/USD moves slowly relative to the 5%
 * CRITICAL band. Disabled (503) when `MANTUA_ADMIN_PRIVATE_KEY` is unset.
 */

/** SP hook is the recommended hook for USDC/EURC at fee tier 100 (→ DYNAMIC_FEE). */
const SP_FEE_TIER = 100;

const SET_PEG_REFERENCE_ABI = [
  {
    type: "function",
    name: "setPegReference",
    stateMutability: "nonpayable",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "refX18", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export class PegSyncUnavailableError extends Error {
  constructor() {
    super("Peg-sync keeper is not configured (MANTUA_ADMIN_PRIVATE_KEY unset).");
    this.name = "PegSyncUnavailableError";
  }
}

export interface PegSyncResult {
  eurUsd: number;
  refX18: string;
  poolId: string;
  hook: string;
  txHash: string;
}

/** Read EUR/USD from Pyth and push it to the SP hook's peg reference on Arc. */
export async function syncEurUsdPegReference(): Promise<PegSyncResult> {
  const key = env.MANTUA_ADMIN_PRIVATE_KEY;
  if (!key) throw new PegSyncUnavailableError();

  const eurUsd = await getPythPrice(PYTH_EUR_USD_FEED_ID);
  if (!eurUsd || eurUsd <= 0) throw new Error("EUR/USD price unavailable from Pyth Hermes.");
  // Fixed-point 1e18 without float drift: format to 12 dp then scale.
  const refX18 = parseUnits(eurUsd.toFixed(12), 18);

  const sp = HOOK_DEPLOYMENTS_ARC["stable-protection"];
  const { key: poolKey } = buildPoolKey(
    "USDC",
    "EURC",
    SP_FEE_TIER,
    sp.hook,
    "stable-protection",
    DEFAULT_CHAIN_ID,
  );
  const poolId = computePoolId(poolKey);

  const account = privateKeyToAccount(key as `0x${string}`);
  const wallet = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(env.ARC_RPC_URL),
  });

  const txHash = await wallet.writeContract({
    address: sp.hook,
    abi: SET_PEG_REFERENCE_ABI,
    functionName: "setPegReference",
    args: [poolId, refX18],
  });

  logger.info({ eurUsd, refX18: refX18.toString(), poolId, txHash }, "peg-sync: set EUR/USD ref");
  return { eurUsd, refX18: refX18.toString(), poolId, hook: sp.hook, txHash };
}

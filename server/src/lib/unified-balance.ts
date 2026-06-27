import type * as UBK from "@circle-fin/unified-balance-kit";
import type * as CWA from "@circle-fin/adapter-circle-wallets";
import { env } from "../env.ts";
import { logger } from "./logger.ts";
import { CircleUnavailableError } from "./circle/client.ts";
import { getAgentWallet, getOrCreateAgentWallet } from "./agent-wallet.ts";

/**
 * Circle Gateway unified balance for the agent wallet ("treasury management" —
 * consolidate USDC across chains into one balance, accessible anywhere). Built
 * on Unified Balance Kit + the Circle Wallets adapter, reusing the same
 * CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET as the agent wallet. The SDK abstracts
 * all Gateway internals (deposit → unified balance; getBalances aggregates).
 *
 * Server-side only (the SDK is); the depositor is the agent wallet's address.
 * Scope today: view + deposit. Spend-to-any-chain is a deferred follow-up (the
 * agent wallet is an SCA, so spend may need an EOA delegate for burn intents).
 */

const ARC_CHAIN = "Arc_Testnet";

// Lazy-load the SDKs INSIDE the call paths (not at module top level). The
// Circle Wallets adapter currently fails to resolve a named export from the
// app's developer-controlled-wallets version, and a top-level static import of
// it crashes the WHOLE server at boot. Loading lazily + behind try/catch keeps
// the rest of the API up and contains any load failure to these endpoints,
// surfaced as a clean 503. (NOTE: until the adapter/DCW version mismatch is
// resolved, deposit will report unavailable.)
let ubkModule: Promise<typeof UBK> | null = null;
function loadUbk(): Promise<typeof UBK> {
  ubkModule ??= import("@circle-fin/unified-balance-kit");
  return ubkModule;
}
let cwaModule: Promise<typeof CWA> | null = null;
function loadCwa(): Promise<typeof CWA> {
  cwaModule ??= import("@circle-fin/adapter-circle-wallets");
  return cwaModule;
}

/** Unified balance is unavailable when creds are missing OR an SDK fails to load. */
export class UnifiedBalanceUnavailableError extends Error {
  constructor(message = "Unified balance is unavailable.") {
    super(message);
    this.name = "UnifiedBalanceUnavailableError";
  }
}

function requireCreds(): { apiKey: string; entitySecret: string } {
  const { CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET } = env;
  if (!CIRCLE_API_KEY || !CIRCLE_ENTITY_SECRET) throw new CircleUnavailableError();
  return { apiKey: CIRCLE_API_KEY, entitySecret: CIRCLE_ENTITY_SECRET };
}

export interface UnifiedBalanceView {
  provisioned: boolean;
  address?: string;
  /** Total confirmed USDC across all chains (human decimal string). */
  totalUsdc?: string;
  /** Per-chain confirmed balances. */
  breakdown?: { chain: string; amount: string }[];
}

export interface UnifiedDepositResult {
  txHash: string;
  explorerUrl?: string;
  amount: string;
}

// Loose views of the SDK result shapes (avoid `any`; we only read a few fields).
interface ChainBalance {
  chain: string;
  confirmedBalance: string;
}
interface AccountBreakdown {
  breakdown?: ChainBalance[];
}
interface DepositResultLike {
  txHash: string;
  explorerUrl?: string;
}

/**
 * Read the agent wallet's unified (cross-chain) USDC balance. Returns
 * `{ provisioned: false }` when the user has no agent wallet yet.
 */
export async function getUnifiedBalances(privyUserId: string): Promise<UnifiedBalanceView> {
  const wallet = await getAgentWallet(privyUserId);
  if (!wallet) return { provisioned: false };
  requireCreds(); // 503 if Circle creds are missing
  let UnifiedBalanceKit: typeof UBK.UnifiedBalanceKit;
  try {
    ({ UnifiedBalanceKit } = await loadUbk());
  } catch (err) {
    logger.error({ err }, "unified-balance SDK failed to load");
    throw new UnifiedBalanceUnavailableError();
  }
  const kit = new UnifiedBalanceKit();
  const res = await kit.getBalances({
    token: "USDC",
    sources: { address: wallet.address },
    networkType: "testnet",
  });

  const breakdown: { chain: string; amount: string }[] = [];
  for (const acct of res.breakdown as unknown as AccountBreakdown[]) {
    for (const c of acct.breakdown ?? []) {
      breakdown.push({ chain: c.chain, amount: c.confirmedBalance });
    }
  }
  return {
    provisioned: true,
    address: wallet.address,
    totalUsdc: res.totalConfirmedBalance,
    breakdown,
  };
}

/**
 * Deposit USDC from the agent wallet (on Arc) into its unified balance. Funds
 * stay owned by the agent wallet — they're just held in Gateway and become
 * spendable across chains — so no spending-cap check applies. Provisions the
 * agent wallet on demand.
 */
export async function depositToUnifiedBalance(
  privyUserId: string,
  walletAddress: string | undefined,
  amount: string,
): Promise<UnifiedDepositResult> {
  const wallet = await getOrCreateAgentWallet(privyUserId, walletAddress);
  const { apiKey, entitySecret } = requireCreds();
  let UnifiedBalanceKit: typeof UBK.UnifiedBalanceKit;
  let createCircleWalletsAdapter: typeof CWA.createCircleWalletsAdapter;
  try {
    ({ UnifiedBalanceKit } = await loadUbk());
    ({ createCircleWalletsAdapter } = await loadCwa());
  } catch (err) {
    logger.error({ err }, "unified-balance SDK failed to load");
    throw new UnifiedBalanceUnavailableError();
  }
  const adapter = createCircleWalletsAdapter({ apiKey, entitySecret });
  const kit = new UnifiedBalanceKit();
  const res = (await kit.deposit({
    from: { adapter, chain: ARC_CHAIN, address: wallet.address },
    amount,
  })) as unknown as DepositResultLike;
  return {
    txHash: res.txHash,
    ...(res.explorerUrl ? { explorerUrl: res.explorerUrl } : {}),
    amount,
  };
}

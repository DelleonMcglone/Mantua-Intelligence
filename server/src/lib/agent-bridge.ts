import type * as BK from "@circle-fin/bridge-kit";
import type * as CWA from "@circle-fin/adapter-circle-wallets";
import { env } from "../env.ts";
import { logger } from "./logger.ts";
import { CircleUnavailableError } from "./circle/client.ts";
import { getAgentWallet, AgentWalletNotFoundError } from "./agent-wallet.ts";
import { checkSpendingCap, recordSpending } from "./spending-cap.ts";
import { getUsdPrice } from "./usd-pricing.ts";
import { logAudit } from "./audit.ts";

/**
 * Bridge USDC OUT of the agent's Circle wallet (Arc Testnet) to another CCTP
 * chain via Circle's Bridge Kit + the Circle Wallets adapter — the same
 * lazy-load pattern as `unified-balance.ts` (a top-level import of the adapter
 * can crash boot on a version mismatch; lazy + try/catch degrades to a clean
 * "bridge unavailable" instead).
 *
 * The recipient defaults to the USER's connected wallet on the destination —
 * the agent's wallet is a smart-contract account that exists only on Arc, so
 * bridging to its own address elsewhere could strand funds.
 */

const ARC_CHAIN = "Arc_Testnet";

/** CCTP-V2 testnet destinations Bridge Kit can reach (mirror of the client's
 *  bridge-chains.ts sdkNames). */
export const AGENT_BRIDGE_DESTINATIONS = [
  "Base_Sepolia",
  "Ethereum_Sepolia",
  "Arbitrum_Sepolia",
  "Unichain_Sepolia",
  "Avalanche_Fuji",
  "Optimism_Sepolia",
  "Polygon_Amoy_Testnet",
  "Linea_Sepolia",
  "Sonic_Testnet",
  "World_Chain_Sepolia",
  "Sei_Testnet",
  "HyperEVM_Testnet",
] as const;
export type AgentBridgeChain = (typeof AGENT_BRIDGE_DESTINATIONS)[number];

/** Alias → chain, for names typed in chat ("base", "sei", "polygon"…). Order
 *  matters: specific aliases before the generic Ethereum catch-all. */
const CHAIN_ALIASES: { chain: AgentBridgeChain; re: RegExp }[] = [
  { chain: "Base_Sepolia", re: /\bbase\b/ },
  { chain: "Arbitrum_Sepolia", re: /\b(arbitrum|arb)\b/ },
  { chain: "Unichain_Sepolia", re: /\b(unichain|uni)\b/ },
  { chain: "Avalanche_Fuji", re: /\b(avalanche|avax|fuji)\b/ },
  { chain: "Optimism_Sepolia", re: /\b(optimism|op)\b/ },
  { chain: "Polygon_Amoy_Testnet", re: /\b(polygon|matic|amoy)\b/ },
  { chain: "Linea_Sepolia", re: /\blinea\b/ },
  { chain: "Sonic_Testnet", re: /\bsonic\b/ },
  { chain: "World_Chain_Sepolia", re: /\b(world[\s-]?chain|world)\b/ },
  { chain: "Sei_Testnet", re: /\bsei\b/ },
  { chain: "HyperEVM_Testnet", re: /\b(hyperevm|hyperliquid|hyper)\b/ },
  { chain: "Ethereum_Sepolia", re: /\b(ethereum|eth|sepolia|mainnet)\b/ },
];

/** Resolve a chain from a Bridge Kit name or a free-text alias. */
export function resolveAgentBridgeChain(input: string): AgentBridgeChain | null {
  const exact = AGENT_BRIDGE_DESTINATIONS.find((c) => c.toLowerCase() === input.toLowerCase());
  if (exact) return exact;
  const t = input.toLowerCase();
  return CHAIN_ALIASES.find((a) => a.re.test(t))?.chain ?? null;
}

// Lazy SDK loaders (see module comment).
let bkModule: Promise<typeof BK> | null = null;
function loadBk(): Promise<typeof BK> {
  bkModule ??= import("@circle-fin/bridge-kit");
  return bkModule;
}
let cwaModule: Promise<typeof CWA> | null = null;
function loadCwa(): Promise<typeof CWA> {
  cwaModule ??= import("@circle-fin/adapter-circle-wallets");
  return cwaModule;
}

export class BridgeUnavailableError extends Error {
  constructor(message = "Bridging is unavailable right now.") {
    super(message);
    this.name = "BridgeUnavailableError";
  }
}

function requireCreds(): { apiKey: string; entitySecret: string } {
  const { CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET } = env;
  if (!CIRCLE_API_KEY || !CIRCLE_ENTITY_SECRET) throw new CircleUnavailableError();
  return { apiKey: CIRCLE_API_KEY, entitySecret: CIRCLE_ENTITY_SECRET };
}

export interface AgentBridgeArgs {
  privyUserId: string;
  /** Human-decimal USDC amount, e.g. "1.5". */
  amount: string;
  /** Bridge Kit chain name or free-text alias ("Base_Sepolia", "sei"…). */
  destinationChain: string;
  /** 0x recipient on the destination chain. */
  recipient: `0x${string}`;
}

export interface AgentBridgeResult {
  amount: string;
  destinationChain: AgentBridgeChain;
  recipient: string;
  burnTxHash?: string;
  mintTxHash?: string;
  usdValue: number;
}

// Loose view of Bridge Kit's result (we only read a few fields).
interface BridgeResultLike {
  state?: string;
  steps?: { name?: string; state?: string; txHash?: string; error?: unknown }[];
}

/** Bridge USDC from the agent wallet on Arc to `recipient` on another chain. */
export async function bridgeFromAgentWallet(args: AgentBridgeArgs): Promise<AgentBridgeResult> {
  const wallet = await getAgentWallet(args.privyUserId);
  if (!wallet) throw new AgentWalletNotFoundError(args.privyUserId);

  const chain = resolveAgentBridgeChain(args.destinationChain);
  if (!chain) {
    throw new Error(
      `Unknown destination "${args.destinationChain}". Supported: ${AGENT_BRIDGE_DESTINATIONS.join(", ")}.`,
    );
  }
  const amountNum = Number(args.amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new Error("amount must be a positive decimal string.");
  }

  const { apiKey, entitySecret } = requireCreds();
  let BridgeKit: typeof BK.BridgeKit;
  let createCircleWalletsAdapter: typeof CWA.createCircleWalletsAdapter;
  try {
    ({ BridgeKit } = await loadBk());
    ({ createCircleWalletsAdapter } = await loadCwa());
  } catch (err) {
    logger.error({ err }, "bridge SDK failed to load");
    throw new BridgeUnavailableError();
  }

  const usdValue = amountNum * ((await getUsdPrice("USDC")) || 1);
  await checkSpendingCap(wallet.address, usdValue);

  const adapter = createCircleWalletsAdapter({ apiKey, entitySecret });
  const kit = new BridgeKit();
  const res = (await kit.bridge({
    from: { adapter, chain: ARC_CHAIN, address: wallet.address },
    to: { chain, useForwarder: true, recipientAddress: args.recipient },
    amount: args.amount,
  })) as unknown as BridgeResultLike;

  if (res.state === "error") {
    const failed = res.steps?.find((s) => s.state === "error");
    await logAudit({
      walletAddress: wallet.address,
      action: "agent_bridge",
      outcome: "failure",
      params: { chain, amount: args.amount, failedStep: failed?.name ?? "unknown" },
    });
    throw new Error(
      failed?.name
        ? `Bridge failed at the ${failed.name} step — the route may not be available for ${chain}.`
        : `Bridge to ${chain} failed.`,
    );
  }

  const tx = (name: string) => res.steps?.find((s) => s.name === name && s.txHash)?.txHash;
  const burnTxHash = tx("burn");
  const mintTxHash = tx("mint");

  await recordSpending(wallet.address, usdValue);
  await logAudit({
    walletAddress: wallet.address,
    action: "agent_bridge",
    outcome: "success",
    ...(burnTxHash ? { txHash: burnTxHash } : {}),
    params: { chain, amount: args.amount, recipient: args.recipient, usdValue, mintTxHash },
  });

  return {
    amount: args.amount,
    destinationChain: chain,
    recipient: args.recipient,
    ...(burnTxHash ? { burnTxHash } : {}),
    ...(mintTxHash ? { mintTxHash } : {}),
    usdValue,
  };
}

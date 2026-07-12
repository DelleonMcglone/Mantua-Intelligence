import { encodeFunctionData, parseUnits } from "viem";
import { env } from "../env.ts";
import { explorerTxUrl } from "./agent-send.ts";
import { AgentWalletNotFoundError, getAgentWallet } from "./agent-wallet.ts";
import { logAudit } from "./audit.ts";
import { executeAgentAbiCall, executeAgentCalldata } from "./circle/execute.ts";
import { baseRpcClient } from "./rpc-client.ts";
import { checkSpendingCap, recordSpending } from "./spending-cap.ts";
import { getToken } from "./tokens.ts";

/**
 * ERC-8183 agent-to-agent commerce from the agent's Circle wallet on Arc.
 *
 * Ports the AgenticCommerce job/escrow actions from the standalone `agent/`
 * EOA package onto the live product's custody model: calls are viem-encoded
 * and executed via Circle Developer-Controlled Wallets (gas-sponsored), so
 * the same wallet that swaps and pays x402 fees can also hire and settle
 * other agents with USDC escrow.
 *
 * Verified contract flow (roles): client `createJob` → provider `setBudget`
 * → client `approve`+`fund` (USDC escrow) → provider `submit` → evaluator
 * `complete` (releases escrow). This module exposes the client and evaluator
 * sides; the counterparty agent drives its own provider-side steps.
 *
 * Escrow funding is real spending — it passes through the daily spending cap
 * and is recorded in the ledger like a swap or send.
 */

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const EMPTY_BYTES = "0x" as const;
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as const;
/** Default job expiry: 7 days. */
const DEFAULT_EXPIRES_IN_SECONDS = 604_800;

// Mirror of agent/src/abis/erc8183.ts (verified against the deployed
// ERC-1967 proxy via Arcscan) — keep both in sync.
const AGENTIC_COMMERCE_ABI = [
  {
    type: "function",
    name: "createJob",
    stateMutability: "nonpayable",
    inputs: [
      { name: "provider", type: "address" },
      { name: "evaluator", type: "address" },
      { name: "expiredAt", type: "uint256" },
      { name: "description", type: "string" },
      { name: "hook", type: "address" },
    ],
    outputs: [{ name: "jobId", type: "uint256" }],
  },
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "complete",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "reason", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "jobCounter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "jobHasBudget",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [{ name: "hasBudget", type: "bool" }],
  },
] as const;

function commerceAddress(): `0x${string}` {
  return env.AGENTIC_COMMERCE_ADDRESS as `0x${string}`;
}

async function requireWallet(privyUserId: string) {
  const wallet = await getAgentWallet(privyUserId);
  if (!wallet) throw new AgentWalletNotFoundError(privyUserId);
  return wallet;
}

export interface CreateJobResult {
  jobId: string;
  txHash: `0x${string}`;
  explorerUrl: string;
  contract: string;
  expiresAt: string;
  next: string;
}

export async function createJobFromAgentWallet(args: {
  privyUserId: string;
  provider: `0x${string}`;
  evaluator: `0x${string}`;
  description: string;
  hook?: `0x${string}` | undefined;
  expiresInSeconds?: number | undefined;
}): Promise<CreateJobResult> {
  const wallet = await requireWallet(args.privyUserId);
  const expiredAt = BigInt(
    Math.floor(Date.now() / 1000) + (args.expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS),
  );
  const callData = encodeFunctionData({
    abi: AGENTIC_COMMERCE_ABI,
    functionName: "createJob",
    args: [args.provider, args.evaluator, expiredAt, args.description, args.hook ?? ZERO_ADDRESS],
  });
  const { txHash } = await executeAgentCalldata({
    walletId: wallet.circleWalletId,
    to: commerceAddress(),
    callData,
  });
  // jobCounter increments on create; the new job's id is counter - 1. Wait
  // for the receipt first so the read reflects this tx (sub-second on Arc).
  await baseRpcClient.waitForTransactionReceipt({ hash: txHash });
  const count = await baseRpcClient.readContract({
    address: commerceAddress(),
    abi: AGENTIC_COMMERCE_ABI,
    functionName: "jobCounter",
  });
  const jobId = count > 0n ? count - 1n : count;
  await logAudit({
    walletAddress: wallet.address,
    action: "agent_commerce",
    outcome: "success",
    txHash,
    params: {
      event: "create_job",
      jobId: String(jobId),
      provider: args.provider,
      evaluator: args.evaluator,
      description: args.description.slice(0, 200),
    },
  });
  return {
    jobId: String(jobId),
    txHash,
    explorerUrl: explorerTxUrl(txHash),
    contract: commerceAddress(),
    expiresAt: new Date(Number(expiredAt) * 1000).toISOString(),
    next: "The provider agent must set the job's budget; then fund the escrow with fund_job.",
  };
}

export interface FundJobResult {
  jobId: string;
  amountUsdc: string;
  approveTxHash: `0x${string}`;
  fundTxHash: `0x${string}`;
  explorerUrl: string;
}

export async function fundJobFromAgentWallet(args: {
  privyUserId: string;
  jobId: string;
  amountUsdc: string;
}): Promise<FundJobResult> {
  const wallet = await requireWallet(args.privyUserId);
  const usdc = getToken("USDC");
  const units = parseUnits(args.amountUsdc, usdc.decimals);
  if (units <= 0n) throw new Error("amountUsdc must be positive");

  // Escrow funding is spending: cap-checked before, ledger-recorded after.
  const usdValue = Number(args.amountUsdc);
  await checkSpendingCap(wallet.address, usdValue);

  const { txHash: approveTxHash } = await executeAgentAbiCall({
    walletId: wallet.circleWalletId,
    to: usdc.address,
    abiFunctionSignature: "approve(address,uint256)",
    abiParameters: [commerceAddress(), units.toString()],
  });
  const callData = encodeFunctionData({
    abi: AGENTIC_COMMERCE_ABI,
    functionName: "fund",
    args: [BigInt(args.jobId), EMPTY_BYTES],
  });
  const { txHash: fundTxHash } = await executeAgentCalldata({
    walletId: wallet.circleWalletId,
    to: commerceAddress(),
    callData,
  });
  await recordSpending(wallet.address, usdValue);
  await logAudit({
    walletAddress: wallet.address,
    action: "agent_commerce",
    outcome: "success",
    txHash: fundTxHash,
    params: { event: "fund_job", jobId: args.jobId, amountUsdc: args.amountUsdc, usdValue },
  });
  return {
    jobId: args.jobId,
    amountUsdc: args.amountUsdc,
    approveTxHash,
    fundTxHash,
    explorerUrl: explorerTxUrl(fundTxHash),
  };
}

export interface SettleJobResult {
  jobId: string;
  txHash: `0x${string}`;
  explorerUrl: string;
}

export async function settleJobFromAgentWallet(args: {
  privyUserId: string;
  jobId: string;
  reason?: string | undefined;
}): Promise<SettleJobResult> {
  const wallet = await requireWallet(args.privyUserId);
  const reason = (args.reason ?? ZERO_BYTES32) as `0x${string}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(reason)) {
    throw new Error("reason must be a 0x 32-byte hash.");
  }
  const callData = encodeFunctionData({
    abi: AGENTIC_COMMERCE_ABI,
    functionName: "complete",
    args: [BigInt(args.jobId), reason, EMPTY_BYTES],
  });
  const { txHash } = await executeAgentCalldata({
    walletId: wallet.circleWalletId,
    to: commerceAddress(),
    callData,
  });
  await logAudit({
    walletAddress: wallet.address,
    action: "agent_commerce",
    outcome: "success",
    txHash,
    params: { event: "settle_job", jobId: args.jobId },
  });
  return { jobId: args.jobId, txHash, explorerUrl: explorerTxUrl(txHash) };
}

export interface JobStatusResult {
  jobId: string;
  exists: boolean;
  budgetSet: boolean;
  contract: string;
}

/** Read-only: whether the job exists and has its budget set (funding precondition). */
export async function getJobStatus(jobId: string): Promise<JobStatusResult> {
  const id = BigInt(jobId);
  const count = await baseRpcClient.readContract({
    address: commerceAddress(),
    abi: AGENTIC_COMMERCE_ABI,
    functionName: "jobCounter",
  });
  const exists = id < count;
  const budgetSet = exists
    ? await baseRpcClient.readContract({
        address: commerceAddress(),
        abi: AGENTIC_COMMERCE_ABI,
        functionName: "jobHasBudget",
        args: [id],
      })
    : false;
  return { jobId, exists, budgetSet, contract: commerceAddress() };
}

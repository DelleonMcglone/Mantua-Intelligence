import { eq } from "drizzle-orm";
import { type Address, type Hex, encodeFunctionData, parseAbi, parseUnits } from "viem";
import { db } from "../db/client.ts";
import { pools, portfolioTransactions, positions } from "../db/schema/trading.ts";
import { users } from "../db/schema/users.ts";
import { explorerTxUrl } from "./agent-send.ts";
import { AgentWalletNotFoundError, getAgentWallet } from "./agent-wallet.ts";
import { getCdpClient } from "./cdp/client.ts";
import { BASE_CHAIN_ID, IS_MAINNET } from "./constants.ts";
import { buildPermit2BatchTypedData } from "./permit2.ts";
import { buildPoolKey } from "./pool-key.ts";
import { baseRpcClient } from "./rpc-client.ts";
import { checkSpendingCap, recordSpending } from "./spending-cap.ts";
import { getToken, type TokenSymbol, ZERO_ADDRESS } from "./tokens.ts";
import { tokenAmountUsd } from "./usd-pricing.ts";
import { buildAddLiquidityCalldata } from "./v4-add-liquidity.ts";
import { PERMIT2, V4_POSITION_MANAGER, type FeeTier } from "./v4-contracts.ts";
import { buildRemoveLiquidityCalldata } from "./v4-remove-liquidity.ts";
import { readSlot0 } from "./v4-state-view.ts";

const CDP_NETWORK: "base" | "base-sepolia" = IS_MAINNET ? "base" : "base-sepolia";
const MAX_UINT = (1n << 256n) - 1n;
/** Same heuristic as the client's `ensurePermit2Approval`. */
const FRESH_APPROVAL_THRESHOLD = 1n << 255n;

const ERC20_ABI = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const PM_PERMIT_BATCH_ABI = [
  {
    type: "function",
    name: "permitBatch",
    stateMutability: "nonpayable",
    inputs: [
      { type: "address", name: "owner" },
      {
        type: "tuple",
        name: "permitBatch",
        components: [
          {
            type: "tuple[]",
            name: "details",
            components: [
              { type: "address", name: "token" },
              { type: "uint160", name: "amount" },
              { type: "uint48", name: "expiration" },
              { type: "uint48", name: "nonce" },
            ],
          },
          { type: "address", name: "spender" },
          { type: "uint256", name: "sigDeadline" },
        ],
      },
      { type: "bytes", name: "signature" },
    ],
    outputs: [],
  },
] as const;

const PM_MULTICALL_ABI = [
  {
    type: "function",
    name: "multicall",
    stateMutability: "payable",
    inputs: [{ type: "bytes[]", name: "data" }],
    outputs: [{ type: "bytes[]", name: "results" }],
  },
] as const;

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC = `0x${"0".repeat(64)}` as const;

interface MintedReceiptLog {
  address: string;
  topics: readonly string[];
}

/**
 * Find the PositionManager `Transfer(0x0, owner, tokenId)` event in the
 * receipt logs. Mirror of the client-side `extractMintedTokenId` so the
 * agent path produces the same `tokenId` shape recorded by user-side
 * adds. Returns null on a failed mint or different recipient.
 */
function extractMintedTokenId(logs: readonly MintedReceiptLog[], owner: string): string | null {
  const ownerTopic = `0x${"0".repeat(24)}${owner.slice(2).toLowerCase()}`;
  const pm = V4_POSITION_MANAGER.toLowerCase();
  for (const l of logs) {
    if (l.address.toLowerCase() !== pm) continue;
    if (l.topics[0] !== TRANSFER_TOPIC) continue;
    if (l.topics[1]?.toLowerCase() !== ZERO_TOPIC) continue;
    if (l.topics[2]?.toLowerCase() !== ownerTopic) continue;
    const idTopic = l.topics[3];
    if (!idTopic) return null;
    return BigInt(idTopic).toString();
  }
  return null;
}

/**
 * Read ERC-20 allowance(agent, PERMIT2) and emit an approve(PERMIT2,
 * MAX) tx if the current allowance is below the
 * `FRESH_APPROVAL_THRESHOLD`. One-time per token, ever — Permit2 is
 * shared infrastructure. No-op for native ETH.
 */
async function ensurePermit2Approval(
  account: Awaited<ReturnType<ReturnType<typeof getCdpClient>["evm"]["getAccount"]>>,
  tokenAddr: Address,
): Promise<`0x${string}` | null> {
  if (tokenAddr === ZERO_ADDRESS) return null;
  const current = await baseRpcClient.readContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, PERMIT2],
  });
  if (current >= FRESH_APPROVAL_THRESHOLD) return null;

  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [PERMIT2, MAX_UINT],
  });
  const networked = await account.useNetwork(CDP_NETWORK);
  const tx = await networked.sendTransaction({
    transaction: { to: tokenAddr, data, value: 0n },
  });
  await networked.waitForTransactionReceipt(tx);
  return tx.transactionHash;
}

export interface AgentAddLiquidityArgs {
  privyUserId: string;
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  fee: FeeTier;
  amountA: string;
  amountB: string;
  slippageBps: number;
  deadlineSeconds: number;
}

export interface AgentAddLiquidityResult {
  txHash: `0x${string}`;
  explorerUrl: string;
  agentAddress: string;
  tokenId: string | null;
  liquidity: string;
  poolKeyHash: `0x${string}`;
  amountARaw: string;
  amountBRaw: string;
  usdValue: number;
  approvalTxA: `0x${string}` | null;
  approvalTxB: `0x${string}` | null;
  network: typeof CDP_NETWORK;
}

/**
 * P6-006 (add) — agent-side equivalent of the user's add-liquidity flow:
 *
 *   1. Lookup agent wallet, parseUnits, USD-value cap check.
 *   2. Ensure agent has approve(PERMIT2, MAX) on each non-native token
 *      (one-time, idempotent via allowance read).
 *   3. Read sqrtPriceX96 from on-chain (fail if pool not initialized —
 *      agent path doesn't initialize pools, that's a pool-create
 *      ticket).
 *   4. Build add-liquidity calldata + Permit2 batch typed data via the
 *      existing Phase 4 server primitives.
 *   5. CDP signTypedData(permit2 batch) → signature.
 *   6. Wrap permit2.permitBatch + modifyLiquidities in
 *      PositionManager.multicall (delegatecall keeps msg.sender = agent
 *      so Permit2 reads the right owner; matches the client's
 *      wrapInMulticall).
 *   7. CDP sendTransaction → receipt → extractMintedTokenId.
 *   8. recordSpending + insert positions row mirroring the user-path
 *      `/api/liquidity/add/record`.
 */
export async function addLiquidityFromAgentWallet(
  args: AgentAddLiquidityArgs,
): Promise<AgentAddLiquidityResult> {
  const { privyUserId, tokenA, tokenB, fee, amountA, amountB, slippageBps, deadlineSeconds } = args;
  if (tokenA === tokenB) throw new Error("tokenA and tokenB must differ");

  const wallet = await getAgentWallet(privyUserId);
  if (!wallet) throw new AgentWalletNotFoundError(privyUserId);

  const tA = getToken(tokenA);
  const tB = getToken(tokenB);
  const amountARaw = parseUnits(amountA, tA.decimals);
  const amountBRaw = parseUnits(amountB, tB.decimals);
  if (amountARaw <= 0n || amountBRaw <= 0n) {
    throw new Error("Both amounts must be positive");
  }

  const usdValue =
    (await tokenAmountUsd(tokenA, amountARaw)) + (await tokenAmountUsd(tokenB, amountBRaw));
  await checkSpendingCap(wallet.address, usdValue);

  const cdp = getCdpClient();
  const account = await cdp.evm.getAccount({ name: wallet.cdpWalletId });

  const approvalTxA = await ensurePermit2Approval(account, tA.native ? ZERO_ADDRESS : tA.address);
  const approvalTxB = await ensurePermit2Approval(account, tB.native ? ZERO_ADDRESS : tB.address);

  const { key } = buildPoolKey(tokenA, tokenB, fee);
  const slot0 = await readSlot0(key);
  if (!slot0) throw new Error("Pool not initialized — create it first");

  const calldata = buildAddLiquidityCalldata({
    tokenA,
    tokenB,
    fee,
    amountARaw,
    amountBRaw,
    sqrtPriceX96: slot0.sqrtPriceX96,
    slippageBps,
    owner: wallet.address as Address,
    deadlineSeconds,
  });

  const permit2Build = await buildPermit2BatchTypedData({
    owner: wallet.address as Address,
    chainId: BASE_CHAIN_ID,
    tokens: [
      { address: calldata.currency0, amountNeeded: BigInt(calldata.amount0Max) },
      { address: calldata.currency1, amountNeeded: BigInt(calldata.amount1Max) },
    ],
    nowSeconds: Math.floor(Date.now() / 1000),
  });

  // permit2Build is null when both tokens are native (impossible — pools
  // always have at least one ERC-20) or already permitted with sufficient
  // allowance + nonexpired permit. In the rare null case, send the inner
  // calldata directly without multicall wrapping.
  const networked = await account.useNetwork(CDP_NETWORK);
  let to: Address = calldata.to;
  let data: Hex = calldata.data;
  if (permit2Build) {
    const sig = await account.signTypedData({
      domain: permit2Build.typedData.domain,
      types: permit2Build.typedData.types,
      primaryType: permit2Build.typedData.primaryType,
      message: permit2Build.permitBatch as unknown as Record<string, unknown>,
    });
    const permitBatchCalldata = encodeFunctionData({
      abi: PM_PERMIT_BATCH_ABI,
      functionName: "permitBatch",
      args: [wallet.address as Address, permit2Build.permitBatch, sig],
    });
    data = encodeFunctionData({
      abi: PM_MULTICALL_ABI,
      functionName: "multicall",
      args: [[permitBatchCalldata, calldata.data]],
    });
    to = V4_POSITION_MANAGER;
  }

  const tx = await networked.sendTransaction({
    transaction: { to, data, value: BigInt(calldata.value || "0") },
  });
  const receipt = await networked.waitForTransactionReceipt(tx);

  const tokenId = extractMintedTokenId(receipt.logs, wallet.address);

  await recordSpending(wallet.address, usdValue);

  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.privyUserId, privyUserId))
    .limit(1);
  const user = userRows.at(0);
  if (user) {
    const params = {
      tokenA,
      tokenB,
      fee,
      amountARaw: amountARaw.toString(),
      amountBRaw: amountBRaw.toString(),
      liquidity: calldata.liquidity,
      tickLower: calldata.tickLower,
      tickUpper: calldata.tickUpper,
      poolKeyHash: calldata.poolKeyHash,
      agent: true,
    };
    await db.insert(portfolioTransactions).values({
      userId: user.id,
      walletAddress: wallet.address,
      action: "add_liquidity",
      txHash: tx.transactionHash,
      chainId: BASE_CHAIN_ID,
      params,
      outcome: "success",
      usdValue: usdValue > 0 ? usdValue.toFixed(2) : null,
    });

    const poolRows = await db
      .select({ id: pools.id })
      .from(pools)
      .where(eq(pools.poolKeyHash, calldata.poolKeyHash))
      .limit(1);
    const pool = poolRows.at(0);
    if (pool) {
      await db.insert(positions).values({
        userId: user.id,
        poolId: pool.id,
        ...(tokenId ? { tokenId } : {}),
        tickLower: calldata.tickLower,
        tickUpper: calldata.tickUpper,
        liquidity: calldata.liquidity,
        status: "open",
        openedTx: tx.transactionHash,
      });
    }
  }

  return {
    txHash: tx.transactionHash,
    explorerUrl: explorerTxUrl(tx.transactionHash),
    agentAddress: wallet.address,
    tokenId,
    liquidity: calldata.liquidity,
    poolKeyHash: calldata.poolKeyHash,
    amountARaw: amountARaw.toString(),
    amountBRaw: amountBRaw.toString(),
    usdValue,
    approvalTxA,
    approvalTxB,
    network: CDP_NETWORK,
  };
}

export interface AgentRemoveLiquidityArgs {
  privyUserId: string;
  /** Internal `positions.id` (uuid). The position must belong to this user. */
  positionId: string;
  /** Percentage 1–100. */
  percentage: number;
  slippageBps: number;
  deadlineSeconds: number;
}

export interface AgentRemoveLiquidityResult {
  txHash: `0x${string}`;
  explorerUrl: string;
  agentAddress: string;
  positionId: string;
  liquidityRemoved: string;
  isFullExit: boolean;
  network: typeof CDP_NETWORK;
}

export async function removeLiquidityFromAgentWallet(
  args: AgentRemoveLiquidityArgs,
): Promise<AgentRemoveLiquidityResult> {
  const { privyUserId, positionId, percentage, slippageBps, deadlineSeconds } = args;

  const wallet = await getAgentWallet(privyUserId);
  if (!wallet) throw new AgentWalletNotFoundError(privyUserId);

  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.privyUserId, privyUserId))
    .limit(1);
  const user = userRows.at(0);
  if (!user) throw new Error("User record missing");

  const posRows = await db
    .select({
      id: positions.id,
      tokenId: positions.tokenId,
      tickLower: positions.tickLower,
      tickUpper: positions.tickUpper,
      liquidity: positions.liquidity,
      status: positions.status,
      token0: pools.token0,
      token1: pools.token1,
      fee: pools.fee,
      tickSpacing: pools.tickSpacing,
      hookAddress: pools.hookAddress,
    })
    .from(positions)
    .innerJoin(pools, eq(positions.poolId, pools.id))
    .where(eq(positions.id, positionId))
    .limit(1);
  const pos = posRows.at(0);
  if (!pos || pos.status !== "open") throw new Error("Position not found or already closed");
  if (!pos.tokenId) throw new Error("Position has no on-chain tokenId");

  const slot0 = await readSlot0({
    currency0: pos.token0 as Address,
    currency1: pos.token1 as Address,
    fee: pos.fee,
    tickSpacing: pos.tickSpacing,
    hooks: (pos.hookAddress ?? ZERO_ADDRESS) as Address,
  });
  if (!slot0) throw new Error("Pool not initialized on-chain");

  const totalLiquidity = BigInt(pos.liquidity);
  const liquidityToRemove = (totalLiquidity * BigInt(percentage)) / 100n;
  const isFullExit = percentage >= 100;

  const calldata = buildRemoveLiquidityCalldata({
    tokenId: BigInt(pos.tokenId),
    liquidityToRemove,
    positionLiquidity: totalLiquidity,
    tickLower: pos.tickLower,
    tickUpper: pos.tickUpper,
    sqrtPriceX96: slot0.sqrtPriceX96,
    currency0: pos.token0 as Address,
    currency1: pos.token1 as Address,
    slippageBps,
    recipient: wallet.address as Address,
    deadlineSeconds,
  });

  const cdp = getCdpClient();
  const account = await cdp.evm.getAccount({ name: wallet.cdpWalletId });
  const networked = await account.useNetwork(CDP_NETWORK);
  const tx = await networked.sendTransaction({
    transaction: {
      to: calldata.to,
      data: calldata.data,
      value: 0n,
    },
  });
  await networked.waitForTransactionReceipt(tx);

  await db.insert(portfolioTransactions).values({
    userId: user.id,
    walletAddress: wallet.address,
    action: "remove_liquidity",
    txHash: tx.transactionHash,
    chainId: BASE_CHAIN_ID,
    params: {
      positionId,
      liquidityRemoved: liquidityToRemove.toString(),
      isFullExit,
      agent: true,
    },
    outcome: "success",
  });

  if (isFullExit) {
    await db
      .update(positions)
      .set({ status: "closed", closedTx: tx.transactionHash })
      .where(eq(positions.id, positionId));
  } else {
    const remaining = totalLiquidity - liquidityToRemove;
    await db
      .update(positions)
      .set({ liquidity: remaining.toString() })
      .where(eq(positions.id, positionId));
  }

  return {
    txHash: tx.transactionHash,
    explorerUrl: explorerTxUrl(tx.transactionHash),
    agentAddress: wallet.address,
    positionId,
    liquidityRemoved: liquidityToRemove.toString(),
    isFullExit,
    network: CDP_NETWORK,
  };
}

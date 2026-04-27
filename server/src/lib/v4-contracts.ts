/**
 * Uniswap v4 contract addresses on Base Mainnet (chain 8453).
 * Verified bytecode-present 2026-04-26.
 */
export const V4_POOL_MANAGER = "0x498581ff718922c3f8e6a244956af099b2652b2b" as const;
export const V4_POSITION_MANAGER = "0x7c5f5a4bbd8fd63184577525326123b519429bdc" as const;
export const V4_STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71" as const;

/** Standard v4 fee tiers (fee in pips: 1 pip = 0.01 bps = 0.0001%). */
export const FEE_TIERS = {
  STABLE: 100, // 0.01%
  LOW: 500, // 0.05%
  MEDIUM: 3_000, // 0.30%
  HIGH: 10_000, // 1.00%
} as const;

export type FeeTier = (typeof FEE_TIERS)[keyof typeof FEE_TIERS];

export const FEE_TIER_LABELS: Record<FeeTier, string> = {
  100: "0.01%",
  500: "0.05%",
  3000: "0.30%",
  10000: "1.00%",
};

/** Canonical tickSpacing per v4 fee tier. */
export const TICK_SPACING_BY_FEE: Record<FeeTier, number> = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
};

export function isFeeTier(n: number): n is FeeTier {
  return n === 100 || n === 500 || n === 3000 || n === 10000;
}

/**
 * v4 PoolManager.initialize ABI fragment. The full PoolManager has many
 * functions; we only need this one for pool creation.
 */
export const POOL_MANAGER_INITIALIZE_ABI = [
  {
    type: "function",
    name: "initialize",
    stateMutability: "nonpayable",
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
      { type: "uint160", name: "sqrtPriceX96" },
    ],
    outputs: [{ type: "int24", name: "tick" }],
  },
] as const;

/**
 * v4 PositionManager.modifyLiquidities ABI fragment. The full PM has more
 * (multicall, permit, etc.); this is the entrypoint we need for mint/
 * increase/decrease via the action encoding.
 */
export const POSITION_MANAGER_MODIFY_LIQUIDITIES_ABI = [
  {
    type: "function",
    name: "modifyLiquidities",
    stateMutability: "payable",
    inputs: [
      { type: "bytes", name: "unlockData" },
      { type: "uint256", name: "deadline" },
    ],
    outputs: [],
  },
] as const;

/**
 * v4 StateView ABI fragments. StateView is a stateless lens contract that
 * reads PoolManager extsload slots without unlocking. We only need
 * getSlot0 for the live sqrtPriceX96/tick.
 *
 * Note: getSlot0 takes the canonical v4 PoolId (`bytes32` =
 * keccak256(abi.encode(PoolKey))), NOT Mantua's internal pool_key_hash
 * (which is a string-concatenated hash). See pool-id.ts for the encoder.
 */
export const STATE_VIEW_ABI = [
  {
    type: "function",
    name: "getSlot0",
    stateMutability: "view",
    inputs: [{ type: "bytes32", name: "poolId" }],
    outputs: [
      { type: "uint160", name: "sqrtPriceX96" },
      { type: "int24", name: "tick" },
      { type: "uint24", name: "protocolFee" },
      { type: "uint24", name: "lpFee" },
    ],
  },
] as const;

/** ERC-20 ABI fragments we need for the approval flow. */
export const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { type: "address", name: "owner" },
      { type: "address", name: "spender" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { type: "address", name: "spender" },
      { type: "uint256", name: "amount" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

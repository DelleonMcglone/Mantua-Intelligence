/**
 * Uniswap v4 contract addresses, network-driven by `MANTUA_NETWORK`.
 * Mainnet addresses verified bytecode-present 2026-04-26; Sepolia
 * addresses sourced from developers.uniswap.org/contracts/v4/deployments
 * 2026-04-28.
 */
import { IS_MAINNET } from "./constants.ts";

const V4_POOL_MANAGER_MAINNET = "0x498581ff718922c3f8e6a244956af099b2652b2b" as const;
const V4_POOL_MANAGER_SEPOLIA = "0x05e73354cfdd6745c338b50bcfdfa3aa6fa03408" as const;
const V4_POSITION_MANAGER_MAINNET = "0x7c5f5a4bbd8fd63184577525326123b519429bdc" as const;
const V4_POSITION_MANAGER_SEPOLIA = "0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80" as const;
const V4_STATE_VIEW_MAINNET = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71" as const;
const V4_STATE_VIEW_SEPOLIA = "0x571291b572ed32ce6751a2cb2486ebee8defb9b4" as const;

export const V4_POOL_MANAGER: `0x${string}` = IS_MAINNET
  ? V4_POOL_MANAGER_MAINNET
  : V4_POOL_MANAGER_SEPOLIA;
export const V4_POSITION_MANAGER: `0x${string}` = IS_MAINNET
  ? V4_POSITION_MANAGER_MAINNET
  : V4_POSITION_MANAGER_SEPOLIA;
export const V4_STATE_VIEW: `0x${string}` = IS_MAINNET
  ? V4_STATE_VIEW_MAINNET
  : V4_STATE_VIEW_SEPOLIA;

/** Canonical Permit2 — same address on every chain (deterministic deploy). */
export const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3" as const;

/**
 * Phase 5 P5-002 — Mantua hook addresses, network-driven.
 *
 * Mainnet entries are intentionally `null` for every hook: none of the
 * four Mantua hooks are deployed on Base Mainnet yet (launch-gating
 * step, after the security suite P5-017 → P5-026 signs them off).
 * Callers that resolve a hook address must handle `null` ("hook not
 * available on this network").
 *
 * Sepolia entries:
 *   - Three hooks (DynamicFee, RWAGate, AsyncLimitOrder) verified live
 *     on Base Sepolia by `npm run verify:hooks` (see
 *     `docs/security/hook-deployments.md`).
 *   - StableProtection's Sepolia address is the **pre-mined** CREATE2
 *     target from the Phase 5b-3.2 dry-run; broadcast lands in Phase
 *     5b-4. Until 5b-4 fires, this address has no bytecode on Base
 *     Sepolia — callers should `eth_getCode` before using it.
 */

const STABLE_PROTECTION_HOOK_MAINNET = null;
const STABLE_PROTECTION_HOOK_SEPOLIA =
  "0x2aCA401Edd335bcb4287E96f0E862f458B41A0C0" as const;
const DYNAMIC_FEE_HOOK_MAINNET = null;
const DYNAMIC_FEE_HOOK_SEPOLIA = "0x25F98678a92Af6aCC54cE3cE687762aCA316C0C0" as const;
const RWA_GATE_HOOK_MAINNET = null;
const RWA_GATE_HOOK_SEPOLIA = "0xbba7cf860b47e16b9b83d8185878ec0fad0d4a80" as const;
const ASYNC_LIMIT_ORDER_HOOK_MAINNET = null;
const ASYNC_LIMIT_ORDER_HOOK_SEPOLIA = "0xb9e29f39bbf01c9d0ff6f1c72859f0ef550fd0c8" as const;

export const STABLE_PROTECTION_HOOK: `0x${string}` | null = IS_MAINNET
  ? STABLE_PROTECTION_HOOK_MAINNET
  : STABLE_PROTECTION_HOOK_SEPOLIA;
export const DYNAMIC_FEE_HOOK: `0x${string}` | null = IS_MAINNET
  ? DYNAMIC_FEE_HOOK_MAINNET
  : DYNAMIC_FEE_HOOK_SEPOLIA;
export const RWA_GATE_HOOK: `0x${string}` | null = IS_MAINNET
  ? RWA_GATE_HOOK_MAINNET
  : RWA_GATE_HOOK_SEPOLIA;
export const ASYNC_LIMIT_ORDER_HOOK: `0x${string}` | null = IS_MAINNET
  ? ASYNC_LIMIT_ORDER_HOOK_MAINNET
  : ASYNC_LIMIT_ORDER_HOOK_SEPOLIA;

export const HOOK_NAMES = [
  "stable-protection",
  "dynamic-fee",
  "rwa-gate",
  "async-limit-order",
] as const;
export type HookName = (typeof HOOK_NAMES)[number];

const HOOK_ADDRESSES: Record<HookName, `0x${string}` | null> = {
  "stable-protection": STABLE_PROTECTION_HOOK,
  "dynamic-fee": DYNAMIC_FEE_HOOK,
  "rwa-gate": RWA_GATE_HOOK,
  "async-limit-order": ASYNC_LIMIT_ORDER_HOOK,
};

/**
 * Resolve a hook address by name on the active network. Returns `null`
 * when the hook isn't deployed on this network — callers should treat
 * that as "hook unavailable" and refuse pool creation that depends on it
 * (rather than falling back to a no-hook pool, which would silently
 * change pool semantics).
 */
export function getHookAddress(name: HookName): `0x${string}` | null {
  return HOOK_ADDRESSES[name];
}

/**
 * v4 PoolKey hook permission flags encoded in the lower 14 bits of each
 * hook's address (see Hooks.sol). Useful for sanity-checking that a
 * resolved hook address actually implements the lifecycle callbacks the
 * caller expects. Values match `npm run verify:hooks` output.
 */
export const HOOK_PERMISSIONS: Record<HookName, readonly string[]> = {
  "stable-protection": ["BEFORE_INITIALIZE", "BEFORE_SWAP", "AFTER_SWAP"],
  "dynamic-fee": ["BEFORE_SWAP", "AFTER_SWAP"],
  "rwa-gate": ["BEFORE_ADD_LIQUIDITY", "BEFORE_REMOVE_LIQUIDITY", "BEFORE_SWAP"],
  "async-limit-order": [
    "AFTER_INITIALIZE",
    "BEFORE_SWAP",
    "AFTER_SWAP",
    "BEFORE_SWAP_RETURNS_DELTA",
  ],
} as const;

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
 * v4 PositionManager ABI fragments — modifyLiquidities is the unlocked
 * action entrypoint; permitBatch wraps Permit2.permit so the batch can
 * be applied atomically with modifyLiquidities via multicall (which uses
 * delegatecall, so msg.sender stays the user).
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

const PERMIT_BATCH_TUPLE = {
  type: "tuple",
  name: "_permitBatch",
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
} as const;

export const POSITION_MANAGER_PERMIT_BATCH_ABI = [
  {
    type: "function",
    name: "permitBatch",
    stateMutability: "payable",
    inputs: [
      { type: "address", name: "owner" },
      PERMIT_BATCH_TUPLE,
      { type: "bytes", name: "signature" },
    ],
    outputs: [{ type: "bytes", name: "err" }],
  },
] as const;

export const POSITION_MANAGER_MULTICALL_ABI = [
  {
    type: "function",
    name: "multicall",
    stateMutability: "payable",
    inputs: [{ type: "bytes[]", name: "data" }],
    outputs: [{ type: "bytes[]", name: "results" }],
  },
] as const;

/**
 * v4 PositionManager view ABI for enriching subgraph-discovered positions.
 * `info` is a packed uint256 — see decodePositionInfo in v4-position-info.ts.
 */
export const POSITION_MANAGER_VIEW_ABI = [
  {
    type: "function",
    name: "getPoolAndPositionInfo",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "tokenId" }],
    outputs: [
      {
        type: "tuple",
        name: "poolKey",
        components: [
          { type: "address", name: "currency0" },
          { type: "address", name: "currency1" },
          { type: "uint24", name: "fee" },
          { type: "int24", name: "tickSpacing" },
          { type: "address", name: "hooks" },
        ],
      },
      { type: "uint256", name: "info" },
    ],
  },
  {
    type: "function",
    name: "getPositionLiquidity",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "tokenId" }],
    outputs: [{ type: "uint128", name: "liquidity" }],
  },
] as const;

/**
 * Permit2 ABI fragments. The `allowance(owner, token, spender)` mapping
 * is a struct view (uint160 amount, uint48 expiration, uint48 nonce).
 * Returned as a tuple by viem's readContract.
 */
export const PERMIT2_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { type: "address", name: "owner" },
      { type: "address", name: "token" },
      { type: "address", name: "spender" },
    ],
    outputs: [
      { type: "uint160", name: "amount" },
      { type: "uint48", name: "expiration" },
      { type: "uint48", name: "nonce" },
    ],
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

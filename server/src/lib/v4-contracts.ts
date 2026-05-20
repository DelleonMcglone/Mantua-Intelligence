/**
 * Uniswap v4 contract addresses, per chain.
 *
 * MVP scope (PR #101): runtime multi-chain. Addresses are keyed by
 * chainId; callers pass `chainId` explicitly. Legacy single-chain
 * exports (V4_POOL_MANAGER, etc.) default to Base Sepolia for code
 * paths not yet migrated — new code MUST use the per-chain getters.
 *
 * Mainnet addresses verified bytecode-present 2026-04-26; Base Sepolia
 * addresses sourced from developers.uniswap.org/contracts/v4/deployments
 * 2026-04-28; Unichain Sepolia addresses sourced from the same page
 * 2026-05-14.
 */
import {
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  DEFAULT_CHAIN_ID,
  UNICHAIN_SEPOLIA_CHAIN_ID,
  type SupportedTestnetChainId,
} from "./chains.ts";
import { IS_MAINNET } from "./constants.ts";

interface V4Addresses {
  poolManager: `0x${string}`;
  positionManager: `0x${string}`;
  stateView: `0x${string}`;
  quoter: `0x${string}`;
  /** v4-core's PoolSwapTest helper — null when the testnet/mainnet
   *  doesn't ship one (production routes via the Uniswap Trading API). */
  poolSwapTest: `0x${string}` | null;
}

const V4_BY_CHAIN: Record<SupportedTestnetChainId, V4Addresses> = {
  [BASE_SEPOLIA_CHAIN_ID]: {
    poolManager: "0x05e73354cfdd6745c338b50bcfdfa3aa6fa03408",
    positionManager: "0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80",
    stateView: "0x571291b572ed32ce6751a2cb2486ebee8defb9b4",
    quoter: "0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba",
    poolSwapTest: "0x8b5bcc363dde2614281ad875bad385e0a785d3b9",
  },
  [UNICHAIN_SEPOLIA_CHAIN_ID]: {
    poolManager: "0x00b036b58a818b1bc34d502d3fe730db729e62ac",
    positionManager: "0xf969aee60879c54baaed9f3ed26147db216fd664",
    stateView: "0xc199f1072a74d4e905aba1a84d9a45e2546b6222",
    quoter: "0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472",
    poolSwapTest: "0x9140a78c1a137c7ff1c151ec8231272af78a99a4",
  },
};

const V4_MAINNET: V4Addresses = {
  poolManager: "0x498581ff718922c3f8e6a244956af099b2652b2b",
  positionManager: "0x7c5f5a4bbd8fd63184577525326123b519429bdc",
  stateView: "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71",
  quoter: "0x0d5e0f971ed27fbff6c2837bf31316121532048d",
  poolSwapTest: null,
};

export function getV4Addresses(chainId: SupportedTestnetChainId): V4Addresses {
  if (IS_MAINNET) return V4_MAINNET;
  return V4_BY_CHAIN[chainId];
}

export function getV4PoolManager(chainId: SupportedTestnetChainId): `0x${string}` {
  return getV4Addresses(chainId).poolManager;
}
export function getV4PositionManager(chainId: SupportedTestnetChainId): `0x${string}` {
  return getV4Addresses(chainId).positionManager;
}
export function getV4StateView(chainId: SupportedTestnetChainId): `0x${string}` {
  return getV4Addresses(chainId).stateView;
}
export function getV4Quoter(chainId: SupportedTestnetChainId): `0x${string}` {
  return getV4Addresses(chainId).quoter;
}
export function getPoolSwapTest(chainId: SupportedTestnetChainId): `0x${string}` | null {
  return getV4Addresses(chainId).poolSwapTest;
}

/** Legacy single-chain export. Prefer `getV4PoolManager(chainId)`. */
export const V4_POOL_MANAGER: `0x${string}` = IS_MAINNET
  ? V4_MAINNET.poolManager
  : V4_BY_CHAIN[BASE_SEPOLIA_CHAIN_ID].poolManager;
/** Legacy single-chain export. Prefer `getV4PositionManager(chainId)`. */
export const V4_POSITION_MANAGER: `0x${string}` = IS_MAINNET
  ? V4_MAINNET.positionManager
  : V4_BY_CHAIN[BASE_SEPOLIA_CHAIN_ID].positionManager;
/** Legacy single-chain export. Prefer `getV4StateView(chainId)`. */
export const V4_STATE_VIEW: `0x${string}` = IS_MAINNET
  ? V4_MAINNET.stateView
  : V4_BY_CHAIN[BASE_SEPOLIA_CHAIN_ID].stateView;
/** Legacy single-chain export. Prefer `getV4Quoter(chainId)`. */
export const V4_QUOTER: `0x${string}` = IS_MAINNET
  ? V4_MAINNET.quoter
  : V4_BY_CHAIN[BASE_SEPOLIA_CHAIN_ID].quoter;
/** Legacy single-chain export. Prefer `getPoolSwapTest(chainId)`. */
export const POOL_SWAP_TEST: `0x${string}` | null = IS_MAINNET
  ? null
  : V4_BY_CHAIN[BASE_SEPOLIA_CHAIN_ID].poolSwapTest;

void BASE_MAINNET_CHAIN_ID;

/** Canonical Permit2 — same address on every chain (deterministic deploy). */
export const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3" as const;

/**
 * Mantua hook addresses, per chain.
 *
 * MVP scope (PR #101):
 *  - Stable Protection: Base Sepolia only (USDC/EURC pair).
 *  - Dynamic Fee: Base Sepolia + Unichain Sepolia. Both deployments
 *    encode `BEFORE_SWAP | AFTER_SWAP` in the lower 14 bits of the
 *    CREATE2-mined address (see DelleonMcglone/dynamic-fee README).
 *
 * Mainnet entries are `null` (launch-gating step).
 */
const STABLE_PROTECTION_BY_CHAIN: Record<SupportedTestnetChainId, `0x${string}` | null> = {
  [BASE_SEPOLIA_CHAIN_ID]: "0xe5e6a9E09Ad1e536788f0c142AD5bc69e8B020C0",
  [UNICHAIN_SEPOLIA_CHAIN_ID]: null,
};

const DYNAMIC_FEE_BY_CHAIN: Record<SupportedTestnetChainId, `0x${string}` | null> = {
  [BASE_SEPOLIA_CHAIN_ID]: "0x9788B8495ebcEC1C1D1436681B0F56C6fc0140c0",
  [UNICHAIN_SEPOLIA_CHAIN_ID]: "0xa5eCBF949D964760f3F7805f59eb4AAc1f2500c0",
};

export const HOOK_NAMES = ["stable-protection", "dynamic-fee"] as const;
export type HookName = (typeof HOOK_NAMES)[number];

export { DEFAULT_CHAIN_ID };

export function getHookAddress(
  name: HookName,
  chainId: SupportedTestnetChainId = DEFAULT_CHAIN_ID,
): `0x${string}` | null {
  if (IS_MAINNET) return null;
  if (name === "stable-protection") return STABLE_PROTECTION_BY_CHAIN[chainId];
  return DYNAMIC_FEE_BY_CHAIN[chainId];
}

/** Legacy single-chain export. Prefer `getHookAddress(name, chainId)`. */
export const STABLE_PROTECTION_HOOK: `0x${string}` | null = IS_MAINNET
  ? null
  : STABLE_PROTECTION_BY_CHAIN[BASE_SEPOLIA_CHAIN_ID];
/** Legacy single-chain export. Prefer `getHookAddress(name, chainId)`. */
export const DYNAMIC_FEE_HOOK: `0x${string}` | null = IS_MAINNET
  ? null
  : DYNAMIC_FEE_BY_CHAIN[BASE_SEPOLIA_CHAIN_ID];

/**
 * v4 PoolKey hook permission flags encoded in the lower 14 bits of each
 * hook's address (see Hooks.sol). Useful for sanity-checking that a
 * resolved hook address actually implements the lifecycle callbacks the
 * caller expects. Values match `npm run verify:hooks` output.
 */
export const HOOK_PERMISSIONS: Record<HookName, readonly string[]> = {
  "stable-protection": ["BEFORE_INITIALIZE", "BEFORE_SWAP", "AFTER_SWAP"],
  "dynamic-fee": ["BEFORE_SWAP", "AFTER_SWAP"],
} as const;

/**
 * v4 dynamic-fee flag. Set in the high bit of the uint24 `fee` field
 * to signal that the hook (not a fixed tier) supplies the per-swap
 * fee in `beforeSwap`. v4-core: `LPFeeLibrary.isDynamicFee`.
 */
export const DYNAMIC_FEE_FLAG = 0x800000;

/**
 * Hooks whose `beforeInitialize` callback enforces
 * `key.fee.isDynamicFee()`. Pool creation with one of these hooks must
 * set `key.fee = DYNAMIC_FEE_FLAG` regardless of which static tier the
 * user picked in the UI; the static tier still picks `tickSpacing`.
 */
export const HOOK_REQUIRES_DYNAMIC_FEE: Record<HookName, boolean> = {
  "stable-protection": true,
  "dynamic-fee": true,
};

/**
 * Resolve the actual `fee` field to encode in the PoolKey. When the
 * hook requires dynamic fees, returns `DYNAMIC_FEE_FLAG`; otherwise
 * returns the user's static fee tier as-is.
 */
export function effectivePoolFee(
  hook: HookName | null | undefined,
  staticFee: number,
): number {
  if (hook && HOOK_REQUIRES_DYNAMIC_FEE[hook]) return DYNAMIC_FEE_FLAG;
  return staticFee;
}

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
 * v4-periphery `V4Quoter.quoteExactInputSingle` — returns the simulated
 * output amount for a single-pool exact-in swap. Non-view but called
 * via `eth_call`, which is fine because the contract reverts at the
 * end of its internal swap simulation; the public wrapper catches that
 * and returns the captured `(amountOut, gasEstimate)`.
 */
export const V4_QUOTER_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        type: "tuple",
        name: "params",
        components: [
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
          { type: "bool", name: "zeroForOne" },
          { type: "uint128", name: "exactAmount" },
          { type: "bytes", name: "hookData" },
        ],
      },
    ],
    outputs: [
      { type: "uint256", name: "amountOut" },
      { type: "uint256", name: "gasEstimate" },
    ],
  },
] as const;

/**
 * v4-core `PoolSwapTest.swap` — proof-of-concept testnet swap path.
 * `testSettings.takeClaims = false` and `settleUsingBurn = false` make
 * the swap behave like a normal user swap (input/output flow through
 * standard ERC-20 transfers, ETH via msg.value). Caller must approve
 * the input ERC-20 to PoolSwapTest first; native ETH is forwarded as
 * `value`.
 */
export const POOL_SWAP_TEST_ABI = [
  {
    type: "function",
    name: "swap",
    stateMutability: "payable",
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
      {
        type: "tuple",
        name: "params",
        components: [
          { type: "bool", name: "zeroForOne" },
          { type: "int256", name: "amountSpecified" },
          { type: "uint160", name: "sqrtPriceLimitX96" },
        ],
      },
      {
        type: "tuple",
        name: "testSettings",
        components: [
          { type: "bool", name: "takeClaims" },
          { type: "bool", name: "settleUsingBurn" },
        ],
      },
      { type: "bytes", name: "hookData" },
    ],
    outputs: [{ type: "int256", name: "delta" }],
  },
] as const;

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
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "tokenId" }],
    outputs: [{ type: "address" }],
  },
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

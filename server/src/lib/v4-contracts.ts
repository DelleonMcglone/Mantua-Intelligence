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
 * 2026-04-28.
 */
import {
  ARC_TESTNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  DEFAULT_CHAIN_ID,
  type SupportedTestnetChainId,
} from "./chains.ts";
import { MARKETS_PERIPHERY_ARC } from "./markets-contracts.ts";

interface V4Addresses {
  poolManager: `0x${string}`;
  positionManager: `0x${string}`;
  stateView: `0x${string}`;
  quoter: `0x${string}`;
  /** v4-core's PoolSwapTest helper — null when the chain doesn't ship one. */
  poolSwapTest: `0x${string}` | null;
}

// Arc Testnet v4 stack — the StableProtection ("hero") deployment. The
// PoolManager + PoolSwapTest were deployed by the stableprotection-hook
// repo; PositionManager/StateView/V4Quoter were deployed against that same
// PoolManager via deploy/arc-hero-periphery (tx batch, block 46501208).
// NOTE: this single stack drives the StableProtection USDC/EURC pool only.
// The DynamicFee hook lives on its OWN PoolManager (see
// HOOK_DEPLOYMENTS_ARC); executing those needs their own periphery deploy.
const V4_BY_CHAIN: Record<SupportedTestnetChainId, V4Addresses> = {
  // Base Sepolia — the CANONICAL Uniswap v4 deployment (developers.uniswap.org
  // /contracts/v4/deployments). Both Mantua hooks on Base Sepolia were
  // deployed against this PoolManager, so one stack serves everything.
  [BASE_SEPOLIA_CHAIN_ID]: {
    poolManager: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
    positionManager: "0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80",
    stateView: "0x571291b572ed32ce6751a2cb2486ebee8defb9b4",
    quoter: "0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba",
    poolSwapTest: "0x8b5bcc363dde2614281ad875bad385e0a785d3b9",
  },
  [ARC_TESTNET_CHAIN_ID]: {
    poolManager: "0x15B5f2c054b9DC788250131FCD1bcfCC34080a59",
    positionManager: "0x47AD8c1C78F9b07c81d833d924BbE36388A4ab78",
    stateView: "0x73Bb8E68c08C528770880c10223670f7aee13824",
    quoter: "0xd57545f0a2C3A721Fc3F1F4f3007b2aA021f4567",
    poolSwapTest: "0xeA44982cB8b71A9BF69bfe3F3f5b43E1790be4d1",
  },
};

export function getV4Addresses(chainId: SupportedTestnetChainId): V4Addresses {
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

/** Legacy single-chain exports. Prefer the per-chain getters. */
export const V4_POOL_MANAGER: `0x${string}` = V4_BY_CHAIN[ARC_TESTNET_CHAIN_ID].poolManager;
export const V4_POSITION_MANAGER: `0x${string}` = V4_BY_CHAIN[ARC_TESTNET_CHAIN_ID].positionManager;
export const V4_STATE_VIEW: `0x${string}` = V4_BY_CHAIN[ARC_TESTNET_CHAIN_ID].stateView;
export const V4_QUOTER: `0x${string}` = V4_BY_CHAIN[ARC_TESTNET_CHAIN_ID].quoter;
export const POOL_SWAP_TEST: `0x${string}` | null = V4_BY_CHAIN[ARC_TESTNET_CHAIN_ID].poolSwapTest;

/** Canonical Permit2 — same address on every chain (deterministic deploy). */
export const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3" as const;

/**
 * Mantua hook addresses on Arc Testnet. Four hooks:
 *  - Stable Protection — USDC/EURC FX-rate-aware peg defense.
 *  - Dynamic Fee — volatile pairs, fee scales with volatility.
 *  - RWAGate — permissioned/allowlisted pools (ComplianceRegistry
 *    0x2978eA98Cc3c5c480d4C9D073DF8599BA761556D).
 *  - ALO — Async Limit Orders.
 *
 * NOTE (deployment topology): each hook was deployed from its own repo
 * against its OWN Uniswap v4 PoolManager, so there is no single canonical
 * PoolManager on Arc testnet yet:
 *   stable-protection → PoolManager 0x15B5f2c054b9DC788250131FCD1bcfCC34080a59
 *   dynamic-fee       → PoolManager 0x7eA87A5919C119DC95855A0BE227fd3241c998F0
 *   rwa-gate          → deferred to mainnet (was PoolManager 0xA29B…D4Dc)
 *   alo               → deferred to mainnet (was PoolManager 0x95b7…083b)
 * `V4_BY_CHAIN` still models a single stack (poolManager + periphery), so
 * execution (add-liquidity/swap/state reads) remains blocked until we
 * either (a) get the periphery — PositionManager/StateView/Quoter/
 * PoolSwapTest — for one canonical PoolManager, or (b) refactor the
 * registry to be per-hook. Hook resolution + pair gating work today.
 */
const STABLE_PROTECTION_BY_CHAIN: Record<SupportedTestnetChainId, `0x${string}` | null> = {
  [BASE_SEPOLIA_CHAIN_ID]: "0xe5e6a9E09Ad1e536788f0c142AD5bc69e8B020C0",
  [ARC_TESTNET_CHAIN_ID]: "0xd1Deea248850BFc239Cb282b793b076357Cb20c0",
};
const DYNAMIC_FEE_BY_CHAIN: Record<SupportedTestnetChainId, `0x${string}` | null> = {
  [BASE_SEPOLIA_CHAIN_ID]: "0x9788B8495ebcEC1C1D1436681B0F56C6fc0140c0",
  [ARC_TESTNET_CHAIN_ID]: "0xA1Be807481F532c074380FCcF05be5e2A3ec80C0",
};
// Mantua ships two hooks: Stable Protection (USDC/EURC) and Dynamic Fee
// (cirBTC pairs). RWAGate and ALO were removed from the product.
export const HOOK_NAMES = ["stable-protection", "dynamic-fee"] as const;
export type HookName = (typeof HOOK_NAMES)[number];

export { DEFAULT_CHAIN_ID };

export function getHookAddress(
  name: HookName,
  chainId: SupportedTestnetChainId = DEFAULT_CHAIN_ID,
): `0x${string}` | null {
  switch (name) {
    case "stable-protection":
      return STABLE_PROTECTION_BY_CHAIN[chainId];
    case "dynamic-fee":
      return DYNAMIC_FEE_BY_CHAIN[chainId];
  }
}

/**
 * Per-hook Arc Testnet deployment manifest, extracted from the four hook
 * repos (DelleonMcglone/{stableprotection-hook,dynamic-fee,RWAgate,
 * limit-orders}) on 2026-06-10. Verified against each repo's
 * broadcast/.../5042002/run-latest.json + deployments manifest + README.
 *
 * KEY FINDING — these are FOUR independent deployments, each with its own
 * PoolManager and v4 **test routers** (PoolSwapTest + PoolModifyLiquidity-
 * Test), NOT the production periphery. None of the repos deployed
 * PositionManager, StateView, or V4Quoter on Arc (the v4 periphery isn't
 * published on Arc testnet). Two pools also use MOCK tokens distinct from
 * the canonical Circle tokens AND from the app's cirBTC registry entry.
 *
 * The app's calldata builders target PositionManager / V4Quoter /
 * StateView, so on-chain execution against these pools is NOT yet wired —
 * it needs either (a) a v4 periphery redeploy on one canonical
 * PoolManager + canonical tokens, or (b) a rewrite of the swap/liquidity/
 * state paths to the test-router model. Recorded as data pending that
 * decision; `null` = not deployed / not found in the repo.
 */
export interface HookDeployment {
  readonly poolManager: `0x${string}`;
  readonly hook: `0x${string}`;
  /** v4 test swap router actually used by this pool (no V4Quoter exists). */
  readonly poolSwapTest: `0x${string}` | null;
  /** v4 test liquidity router actually used (no PositionManager exists). */
  readonly poolModifyLiquidityTest: `0x${string}` | null;
  /** Production periphery — deployed per-hook via deploy/arc-*-periphery
   *  (null where not yet deployed, e.g. rwa-gate). */
  readonly positionManager: `0x${string}` | null;
  readonly stateView: `0x${string}` | null;
  readonly quoter: `0x${string}` | null;
  /** Token addresses this specific pool was initialized with. */
  readonly token0: `0x${string}`;
  readonly token1: `0x${string}`;
  /** Whether token0/token1 are the canonical Circle/app tokens or mocks. */
  readonly tokensAreMocks: boolean;
  /** Extra contracts (e.g. ComplianceRegistry for rwa-gate). */
  readonly aux?: Readonly<Record<string, `0x${string}`>>;
}

export const HOOK_DEPLOYMENTS_ARC: Readonly<Record<HookName, HookDeployment>> = {
  "stable-protection": {
    poolManager: "0x15B5f2c054b9DC788250131FCD1bcfCC34080a59",
    hook: "0xd1Deea248850BFc239Cb282b793b076357Cb20c0",
    poolSwapTest: "0xeA44982cB8b71A9BF69bfe3F3f5b43E1790be4d1",
    poolModifyLiquidityTest: "0x4f81385fa50336e4cbA6718A803f3e2Baa09D1c0",
    positionManager: "0x47AD8c1C78F9b07c81d833d924BbE36388A4ab78",
    stateView: "0x73Bb8E68c08C528770880c10223670f7aee13824",
    quoter: "0xd57545f0a2C3A721Fc3F1F4f3007b2aA021f4567",
    token0: "0x3600000000000000000000000000000000000000", // USDC (canonical)
    token1: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", // EURC (canonical)
    tokensAreMocks: false,
  },
  "dynamic-fee": {
    poolManager: "0x7eA87A5919C119DC95855A0BE227fd3241c998F0",
    hook: "0xA1Be807481F532c074380FCcF05be5e2A3ec80C0",
    poolSwapTest: "0xAa096011E6604df33762d611cbBdaA0671F19Bdb",
    poolModifyLiquidityTest: "0xdD225f3B7b621287657B490B3bC945E3ecfC8EbA",
    positionManager: "0xDa1bfA53fA93463fB9Abd349bad381667D29b88d",
    stateView: "0x6F4eD6D86e8d770Dc7Ef027011d7cd6c12Db40c9",
    quoter: "0x2CF521F13658FE57958D09B40Ee3420D974EE7eC",
    token0: "0xFE3f00877d20Fb599351182EAef78DE3EF531dF6", // MOCK USDC (6dp)
    token1: "0xAeE5a58b0ae058bfd358CeeB72e4804C16d94F5E", // MOCK cirBTC (8dp)
    tokensAreMocks: true,
  },
};

/**
 * Base Sepolia hook deployments — unlike Arc, BOTH hooks were deployed
 * against the canonical Uniswap v4 PoolManager, so the canonical periphery
 * (PositionManager / StateView / V4Quoter) serves them all. Addresses from
 * the hook repos' READMEs (DelleonMcglone/{stableprotection-hook,
 * dynamic-fee}), cross-checked against docs/security/hook-deployments.md.
 */
export const HOOK_DEPLOYMENTS_BASE_SEPOLIA: Readonly<Record<HookName, HookDeployment>> = {
  "stable-protection": {
    poolManager: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
    hook: "0xe5e6a9E09Ad1e536788f0c142AD5bc69e8B020C0",
    poolSwapTest: "0x8b5bcc363dde2614281ad875bad385e0a785d3b9",
    poolModifyLiquidityTest: null,
    positionManager: "0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80",
    stateView: "0x571291b572ed32ce6751a2cb2486ebee8defb9b4",
    quoter: "0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba",
    token0: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC (Circle)
    token1: "0x808456652fdb597867f38412077A9182bf77359F", // EURC (Circle)
    tokensAreMocks: false,
  },
  "dynamic-fee": {
    poolManager: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
    hook: "0x9788B8495ebcEC1C1D1436681B0F56C6fc0140c0",
    poolSwapTest: "0xF778eF19F4A0065430C55a7cD09d287368947C29",
    poolModifyLiquidityTest: "0x9f12E9d064398e07153Ca7E1401C71343edB772B",
    positionManager: "0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80",
    stateView: "0x571291b572ed32ce6751a2cb2486ebee8defb9b4",
    quoter: "0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba",
    token0: "0x839Cc782708f1768F0F7591eA0c7D08290ba2a3c", // MOCK tWETH
    token1: "0x8b6de320b93c2f8dEE5C9392A001E03CE6cc8Fe6", // MOCK tUSDC
    tokensAreMocks: true,
    aux: { tLINK: "0x16538c37818d580F7f919D4583D7935C8624567E" },
  },
};

/** Per-chain hook deployment manifest. */
export const HOOK_DEPLOYMENTS: Record<
  SupportedTestnetChainId,
  Readonly<Record<HookName, HookDeployment>>
> = {
  [BASE_SEPOLIA_CHAIN_ID]: HOOK_DEPLOYMENTS_BASE_SEPOLIA,
  [ARC_TESTNET_CHAIN_ID]: HOOK_DEPLOYMENTS_ARC,
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/**
 * Resolve the full v4 stack (PoolManager + periphery) for a pool by its
 * HOOK ADDRESS — i.e. `PoolKey.hooks`. Each Mantua hook lives on its own
 * PoolManager + periphery (see HOOK_DEPLOYMENTS_ARC), so the stack a pool
 * routes to is determined by which hook it uses.
 *
 *  - zero address (no-hook pool) → the default hero stack.
 *  - a known hook with deployed periphery → that hook's stack.
 *  - a known hook whose periphery isn't deployed yet (e.g. rwa-gate) → throws.
 *  - an unrecognized hook → the default hero stack (best effort).
 *
 * The StableProtection hook resolves to the hero stack itself, so existing
 * StableProtection/no-hook flows are byte-for-byte unchanged.
 *
 * `chainId` defaults to the server DEFAULT (Arc) so legacy callers keep
 * their behavior; chain-aware code passes it explicitly. On Base Sepolia
 * every hook shares the canonical PoolManager, so everything resolves to
 * the canonical stack.
 */
export function getV4StackForHook(
  hookAddress: string,
  chainId: SupportedTestnetChainId = DEFAULT_CHAIN_ID,
): V4Addresses {
  const lower = hookAddress.toLowerCase();
  const defaultStack = V4_BY_CHAIN[chainId];
  if (lower === ZERO_ADDR) return defaultStack;
  // Dynamic Market Hook — on Arc it has its own PoolManager + periphery
  // (DM-112: market pools route directly). Registered here so the shared
  // quote/calldata builders work on market pools without special-casing.
  if (chainId === ARC_TESTNET_CHAIN_ID && lower === DYNAMIC_MARKET_ARC.hook.toLowerCase()) {
    return {
      poolManager: DYNAMIC_MARKET_ARC.poolManager,
      positionManager: MARKETS_PERIPHERY_ARC.positionManager,
      stateView: MARKETS_PERIPHERY_ARC.stateView,
      quoter: MARKETS_PERIPHERY_ARC.quoter,
      poolSwapTest: MARKETS_PERIPHERY_ARC.poolSwapTest,
    };
  }
  for (const name of HOOK_NAMES) {
    const d = HOOK_DEPLOYMENTS[chainId][name];
    if (d.hook.toLowerCase() === lower) {
      if (!d.positionManager || !d.stateView || !d.quoter) {
        throw new Error(
          `Hook "${name}" periphery is not deployed on this chain yet — cannot route pool operations to it.`,
        );
      }
      return {
        poolManager: d.poolManager,
        positionManager: d.positionManager,
        stateView: d.stateView,
        quoter: d.quoter,
        poolSwapTest: d.poolSwapTest,
      };
    }
  }
  return defaultStack;
}

/** Legacy single-chain exports. Prefer `getHookAddress(name, chainId)`. */
export const STABLE_PROTECTION_HOOK: `0x${string}` | null =
  STABLE_PROTECTION_BY_CHAIN[ARC_TESTNET_CHAIN_ID];
export const DYNAMIC_FEE_HOOK: `0x${string}` | null = DYNAMIC_FEE_BY_CHAIN[ARC_TESTNET_CHAIN_ID];

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
  "stable-protection": true, // SP pool: tickSpacing 1, dynamic fee (repo README)
  "dynamic-fee": true, // fee scales with volatility
};

/**
 * Resolve the actual `fee` field to encode in the PoolKey. When the
 * hook requires dynamic fees, returns `DYNAMIC_FEE_FLAG`; otherwise
 * returns the user's static fee tier as-is.
 */
export function effectivePoolFee(hook: HookName | null | undefined, staticFee: number): number {
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
    // v4 PositionManager mints sequentially from tokenId 1; `nextTokenId`
    // is the id the next mint will use, so live ids are [1, nextTokenId).
    type: "function",
    name: "nextTokenId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
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
  {
    // Current cumulative fee growth inside a tick range, scaled by 2^128.
    type: "function",
    name: "getFeeGrowthInside",
    stateMutability: "view",
    inputs: [
      { type: "bytes32", name: "poolId" },
      { type: "int24", name: "tickLower" },
      { type: "int24", name: "tickUpper" },
    ],
    outputs: [
      { type: "uint256", name: "feeGrowthInside0X128" },
      { type: "uint256", name: "feeGrowthInside1X128" },
    ],
  },
  {
    // A position's liquidity + the fee growth snapshot taken at its last
    // update. PositionManager positions are keyed by owner=PositionManager,
    // salt=bytes32(tokenId).
    type: "function",
    name: "getPositionInfo",
    stateMutability: "view",
    inputs: [
      { type: "bytes32", name: "poolId" },
      { type: "address", name: "owner" },
      { type: "int24", name: "tickLower" },
      { type: "int24", name: "tickUpper" },
      { type: "bytes32", name: "salt" },
    ],
    outputs: [
      { type: "uint128", name: "liquidity" },
      { type: "uint256", name: "feeGrowthInside0LastX128" },
      { type: "uint256", name: "feeGrowthInside1LastX128" },
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

// ─── Dynamic Market Hook stack (B2-005) ─────────────────────────────────────

/**
 * The sports-market v4 stack, deployed 2026-08-17 and verified on ArcScan
 * (record: deploy/dynamic-market/README.md).
 *
 * Deliberately NOT an entry in `HOOK_DEPLOYMENTS_ARC`: that registry
 * describes one fixed token0/token1 pool per hook and feeds the swap-venue
 * routing. Market pools don't work that way — each Market mints its own
 * YES/NO pair and initializes its own pool on this PoolManager, and market
 * pools route directly rather than through the venue picker (DM-112). The
 * v4-contracts tests assert the absence stays deliberate.
 */
export interface DynamicMarketDeployment {
  readonly poolManager: `0x${string}`;
  readonly registry: `0x${string}`;
  readonly hook: `0x${string}`;
  /** Registry operator — registers pools, pauses, rotates roles. */
  readonly operator: `0x${string}`;
  /** Keeper = the market resolver key (spec §0.1). */
  readonly keeper: `0x${string}`;
}

export const DYNAMIC_MARKET_ARC: DynamicMarketDeployment = {
  poolManager: "0xee196B3F83Fe6f57E074C399DBdeFe07e1407636",
  registry: "0xEA8c2f329E7eBD9a67FA7E502CEcc938bE3ec7a6",
  hook: "0xbb5D42DC40128fa681882cA49f9A74d50D15E8c0",
  operator: "0x4EF85782DE0826BeaF9B40Cc534C9aAf849312C3",
  keeper: "0x4EF85782DE0826BeaF9B40Cc534C9aAf849312C3",
};

/**
 * Per-chain Dynamic Market deployments. Arc is live; the Base Sepolia
 * entry is filled by the Base deployment of the same stack (see
 * deploy/dynamic-market/README.md) — `undefined` until then.
 */
export const DYNAMIC_MARKET_BY_CHAIN: Partial<
  Record<SupportedTestnetChainId, DynamicMarketDeployment>
> = {
  [ARC_TESTNET_CHAIN_ID]: DYNAMIC_MARKET_ARC,
};

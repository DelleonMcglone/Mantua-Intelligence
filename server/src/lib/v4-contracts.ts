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
import { ARC_TESTNET_CHAIN_ID, DEFAULT_CHAIN_ID, type SupportedTestnetChainId } from "./chains.ts";

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
// The DynamicFee/RWAGate/ALO hooks live on their OWN PoolManagers (see
// HOOK_DEPLOYMENTS_ARC); executing those needs their own periphery deploy.
const V4_BY_CHAIN: Record<SupportedTestnetChainId, V4Addresses> = {
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
 *   rwa-gate          → PoolManager 0xA29B7D158f2b2113Bd60eeD765866f794096D4Dc
 *   alo               → PoolManager 0x95b7d2f0712f997A34c7D1b4CBaE144251CE083b
 * `V4_BY_CHAIN` still models a single stack (poolManager + periphery), so
 * execution (add-liquidity/swap/state reads) remains blocked until we
 * either (a) get the periphery — PositionManager/StateView/Quoter/
 * PoolSwapTest — for one canonical PoolManager, or (b) refactor the
 * registry to be per-hook. Hook resolution + pair gating work today.
 */
const STABLE_PROTECTION_BY_CHAIN: Record<SupportedTestnetChainId, `0x${string}` | null> = {
  [ARC_TESTNET_CHAIN_ID]: "0xF131A048875E578A0F89393e858C0442fcD7e0C0",
};
const DYNAMIC_FEE_BY_CHAIN: Record<SupportedTestnetChainId, `0x${string}` | null> = {
  [ARC_TESTNET_CHAIN_ID]: "0xA1Be807481F532c074380FCcF05be5e2A3ec80C0",
};
const RWAGATE_BY_CHAIN: Record<SupportedTestnetChainId, `0x${string}` | null> = {
  // Clean redeploy (hook ported to current v4 + full periphery) — replaces the
  // original 0xda48… whose v4-core/periphery versions were mismatched.
  [ARC_TESTNET_CHAIN_ID]: "0xC5B49e30Fb7FD99FCB608Bd661F28AfcC44FCA80",
};
const ALO_BY_CHAIN: Record<SupportedTestnetChainId, `0x${string}` | null> = {
  [ARC_TESTNET_CHAIN_ID]: "0x18c2c2E657912E21091E364b5daB4f9702c810c8",
};

export const HOOK_NAMES = ["stable-protection", "dynamic-fee", "rwa-gate", "alo"] as const;
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
    case "rwa-gate":
      return RWAGATE_BY_CHAIN[chainId];
    case "alo":
      return ALO_BY_CHAIN[chainId];
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
    hook: "0xF131A048875E578A0F89393e858C0442fcD7e0C0",
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
  // Clean redeploy from one consistent v4 version (hook ported to current v4 so
  // it can carry the periphery the app needs). Supersedes the original mismatched
  // deployment (old hook 0xda48…, PoolManager 0xA29B…). See deploy/arc-rwagate-clean.
  "rwa-gate": {
    poolManager: "0xBC9C4e3e51E18Ea44c7363391d29ed300db57511",
    hook: "0xC5B49e30Fb7FD99FCB608Bd661F28AfcC44FCA80",
    poolSwapTest: "0xE6D1d7d837099132b9A6c68B1e3B2fdEe5feEF00",
    poolModifyLiquidityTest: "0xB8736964413a970186359089490f578191170AC0",
    positionManager: "0xCa059a9a7064EcC446aB34eAe400e1a76D3288C3",
    stateView: "0xBecb1cd296675CFC3fC8e63c4838590A4C97196d",
    quoter: "0x49ffeA1ECd7760fC55F3598D7A0d89239cfeAea9",
    token0: "0x3600000000000000000000000000000000000000", // USDC (canonical)
    token1: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", // EURC (canonical)
    tokensAreMocks: false,
    aux: { complianceRegistry: "0x5E33Ed3D77Ff22B9c6eD689a18a040E7633f9003" },
  },
  alo: {
    poolManager: "0x95b7d2f0712f997A34c7D1b4CBaE144251CE083b",
    hook: "0x18c2c2E657912E21091E364b5daB4f9702c810c8",
    // Deployed via deploy/arc-alo-periphery/DeployAloSwapRouter (the ALO repo
    // shipped no swap router); enables swaps on ALO pools.
    poolSwapTest: "0xFCf895f7F5737b1D582a0bD4b131f88434a94433",
    poolModifyLiquidityTest: null, // NOT FOUND in repo
    positionManager: "0x7866e36b7576DF5167cf76770799096Ba6fcD882",
    stateView: "0xbF8dC490E538a7749f9DF6B34Ee740650D325b15",
    quoter: "0xA12B21D108Eb0ad982870d90CcB66976274d3b18",
    token0: "0x1B056aDe32E5F1F782638e21bF1E665059F47971", // MOCK cirBTC (8dp)
    token1: "0x3600000000000000000000000000000000000000", // USDC (native)
    tokensAreMocks: true,
  },
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/** The default v4 stack for no-hook pools = the StableProtection ("hero")
 *  deployment. */
const HERO_STACK: V4Addresses = V4_BY_CHAIN[ARC_TESTNET_CHAIN_ID];

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
 */
export function getV4StackForHook(hookAddress: string): V4Addresses {
  const lower = hookAddress.toLowerCase();
  if (lower === ZERO_ADDR) return HERO_STACK;
  for (const name of HOOK_NAMES) {
    const d = HOOK_DEPLOYMENTS_ARC[name];
    if (d.hook.toLowerCase() === lower) {
      if (!d.positionManager || !d.stateView || !d.quoter) {
        throw new Error(
          `Hook "${name}" periphery is not deployed on Arc yet — cannot route pool operations to it.`,
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
  return HERO_STACK;
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
  // TODO(Phase E): confirm from the deployed bytecode (npm run verify:hooks).
  "rwa-gate": ["BEFORE_INITIALIZE", "BEFORE_SWAP"],
  alo: ["BEFORE_SWAP", "AFTER_SWAP"],
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
  // Confirmed from the hook repos' deployed pools: RWAGate and ALO pools
  // were both initialized with a STATIC fee tier (3000 / tickSpacing 60),
  // so neither overrides the fee with DYNAMIC_FEE_FLAG.
  "rwa-gate": false,
  alo: false,
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

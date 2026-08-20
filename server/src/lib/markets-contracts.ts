import { parseAbi } from "viem";
import {
  ARC_TESTNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  type SupportedTestnetChainId,
} from "./chains.ts";

/**
 * The deployed sports-market settlement layer on Arc Testnet (B4 wiring,
 * broadcast 2026-08-17, both contracts verified on ArcScan).
 *
 * Deploy order was Resolver → MarketFactory → one-shot `setFactory`, so the
 * factory's immutable `resolver` is the Resolver CONTRACT — the fixed
 * authority address every Market burns in — while the keys behind it
 * (signer, operator) rotate on the Resolver without redeploying markets.
 *
 * On-chain wiring probed post-deploy: `resolver.factory()` ==
 * `MARKETS_ARC.factory`, `factory.resolver()` == `MARKETS_ARC.resolver`,
 * `factory.collateral()` == canonical Arc USDC.
 */
export const MARKETS_ARC = {
  /** MarketFactory — tx 0x64c1ccbb…5c51e70b */
  factory: "0x0cd79B383c3f10F786bF9B942F791283dFB4d6e6",
  /** Resolver — tx 0x17f78394…cc0d7470 */
  resolver: "0x76578c4EA626bEe114e5B72939e7927eF5f1CAbF",
  /** Canonical Arc USDC (6dp ERC-20 interface), the markets' collateral. */
  collateral: "0x3600000000000000000000000000000000000000",
} as const;

/**
 * v4 periphery for the market PoolManager — broadcast 2026-08-17
 * (contracts/broadcast/DeployMarketPeriphery.s.sol), all pointing at
 * `MARKETS_PERIPHERY_ARC`-probed `poolManager()` == the B2-005 manager.
 * Receipt labels were scrambled (same Foundry quirk as B2-005); the
 * mapping below is confirmed by Blockscout bytecode verification (5/6)
 * and on-chain `poolManager()` probes (6/6). PositionManager's verify
 * fails on Blockscout (large via-ir contract) — args are in the
 * broadcast record.
 */
export const MARKETS_PERIPHERY_ARC = {
  poolSwapTest: "0x1791972C76a8Bcb9da83E50B9435612590a0102f",
  poolModifyLiquidityTest: "0x6A8Ce701aB14a2909F22a18063426fEE016A36da",
  stateView: "0x17a69A23F3c0F7F0dCA6391f967C020BaC0906da",
  quoter: "0x448E16702C19fF0b0AF7b51D675Cc40f1b2D5281",
  positionDescriptor: "0x52e8c370Ff772408b925f8524f49BFd1B96Beb93",
  positionManager: "0xd288EE632fb58101211C7c87b3FCF44328C6866d",
} as const;

export interface MarketsDeployment {
  factory: `0x${string}`;
  resolver: `0x${string}`;
  collateral: `0x${string}`;
}

export interface MarketsPeriphery {
  poolSwapTest: `0x${string}`;
  poolModifyLiquidityTest: `0x${string}`;
  stateView: `0x${string}`;
  quoter: `0x${string}`;
  positionDescriptor: `0x${string}` | null;
  positionManager: `0x${string}`;
}

/**
 * Base Sepolia markets layer, deployed 2026-08-20 by 0x9215…024d
 * (contracts/broadcast/DeployMarkets.s.sol/84532). Probed post-deploy:
 * `resolver.factory()` == this factory. Collateral is Circle's Base
 * Sepolia USDC.
 */
export const MARKETS_BASE_SEPOLIA: MarketsDeployment = {
  factory: "0x9aB104e89F8de7bc240a134Dc6adBCe7124D3d84",
  resolver: "0x0FEAf3BA53E9F163c8060F4d437bcC77F86E4270",
  collateral: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

/** Per-chain markets settlement layer. */
export const MARKETS_BY_CHAIN: Partial<Record<SupportedTestnetChainId, MarketsDeployment>> = {
  [BASE_SEPOLIA_CHAIN_ID]: MARKETS_BASE_SEPOLIA,
  [ARC_TESTNET_CHAIN_ID]: MARKETS_ARC,
};

/**
 * Base Sepolia market-pool periphery, deployed 2026-08-20 against the
 * Dynamic Market PoolManager 0x53AA…fDCa. All five functional contracts
 * probed on-chain: `poolManager()`/`manager()` == that PoolManager.
 */
export const MARKETS_PERIPHERY_BASE_SEPOLIA: MarketsPeriphery = {
  poolSwapTest: "0x4357c1d769fc94278ae85b36e22dd494cca078b4",
  poolModifyLiquidityTest: "0x37fbd7e25de3259340e0879ec15f19c56abcc55b",
  stateView: "0xc352dc25d3ab4748cce6600efb3d5edf42613a45",
  quoter: "0xbb91b69d888afb30eebd373023480d2007d37cd6",
  positionDescriptor: "0x5f30b3ff7b65e3c06a02a2e120c9a2478ea26be9",
  positionManager: "0x275dc77b579b56eb493732f177b1109141ad9a67",
};

/**
 * Per-chain market-pool periphery (the Dynamic Market PoolManager's
 * routers/lens).
 */
export const MARKETS_PERIPHERY_BY_CHAIN: Partial<
  Record<SupportedTestnetChainId, MarketsPeriphery>
> = {
  [BASE_SEPOLIA_CHAIN_ID]: MARKETS_PERIPHERY_BASE_SEPOLIA,
  [ARC_TESTNET_CHAIN_ID]: MARKETS_PERIPHERY_ARC,
};

export const MARKET_FACTORY_ABI = parseAbi([
  "function createMarketIfAbsent(bytes32 marketId, uint64 startsAt, string label) returns (address market, bool created)",
  "function marketOf(bytes32 marketId) view returns (address)",
]);

export const RESOLVER_CONTRACT_ABI = parseAbi([
  "function freeze(bytes32 marketId)",
  "function resolve(bytes32 marketId, uint8 outcome)",
  "function voidMarket(bytes32 marketId)",
]);

export const MARKET_ABI = parseAbi([
  "function yesToken() view returns (address)",
  "function noToken() view returns (address)",
]);

export const POOL_MANAGER_INIT_ABI = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "function initialize(PoolKey key, uint160 sqrtPriceX96) returns (int24 tick)",
]);

export const REGISTRY_ABI = parseAbi([
  "function registerPool(bytes32 poolId, uint64 kickoffTimestamp, uint64 resolutionTimestamp, bool yesIsToken0, uint8 outcomeDecimals)",
  "function isRegistered(bytes32 poolId) view returns (bool)",
]);

export const STATE_VIEW_ABI = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)",
]);

export const MARKET_SPLIT_ABI = parseAbi(["function split(uint256 amount)"]);

export const ERC20_APPROVE_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export const LP_ROUTER_ABI = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "struct ModifyLiquidityParams { int24 tickLower; int24 tickUpper; int256 liquidityDelta; bytes32 salt; }",
  "function modifyLiquidity(PoolKey key, ModifyLiquidityParams params, bytes hookData) payable returns (int256)",
]);

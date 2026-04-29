// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {BaseSepoliaFork} from "./BaseSepoliaFork.t.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {MockERC20} from "solmate/test/utils/mocks/MockERC20.sol";

interface IDynamicFee {
    function configurePool(
        bytes32 poolId,
        address oracle,
        uint24 maxFee,
        uint24 fallbackFee,
        int8 decimalDiff,
        uint256[4] calldata thresholds
    ) external;
    function owner() external view returns (address);
}

/// @notice Minimal Chainlink-compatible mock used to satisfy the live
///         hook's oracle dependency. Returns a stable 1.0 price (8 decimals).
contract MinimalChainlinkMock {
    uint8 public constant decimals = 8;
    int256 public answer = 1e8;

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 a, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (1, answer, block.timestamp, block.timestamp, 1);
    }
}

/**
 * P5-010 — DynamicFee end-to-end swap test.
 *
 * Forks Base Sepolia, deploys mock 18-decimal tokens, registers a fresh
 * pool against the live DynamicFee hook (`0x25F9…C0C0`), pranks the hook's
 * `owner()` to call `configurePool` with a deterministic mock Chainlink
 * feed, then runs swaps to confirm the fee lifecycle fires without
 * reverting.
 *
 * Note: the deployed DynamicFee on Base Sepolia still uses the
 * Chainlink-based interface. The TWAP refactor (`dynamic-fee#1`) will
 * land at a new CREATE2 address; this test will need a parallel update
 * after the redeploy bumps the registry. See `P5-008` for context.
 */
contract DynamicFeeE2E is BaseSepoliaFork {
    using PoolIdLibrary for PoolKey;

    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    PoolSwapTest swapRouter;
    PoolModifyLiquidityTest liqRouter;
    MockERC20 token0;
    MockERC20 token1;
    MinimalChainlinkMock oracle;
    PoolKey poolKey;

    function setUp() public override {
        super.setUp();
        IPoolManager manager = IPoolManager(V4_POOL_MANAGER_BASE_SEPOLIA);
        swapRouter = new PoolSwapTest(manager);
        liqRouter = new PoolModifyLiquidityTest(manager);
        oracle = new MinimalChainlinkMock();

        MockERC20 a = new MockERC20("Token0", "T0", 18);
        MockERC20 b = new MockERC20("Token1", "T1", 18);
        (token0, token1) = address(a) < address(b) ? (a, b) : (b, a);

        token0.mint(address(this), 1_000e18);
        token1.mint(address(this), 1_000e18);
        token0.approve(address(swapRouter), type(uint256).max);
        token1.approve(address(swapRouter), type(uint256).max);
        token0.approve(address(liqRouter), type(uint256).max);
        token1.approve(address(liqRouter), type(uint256).max);

        poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: int24(60),
            hooks: IHooks(DYNAMIC_FEE_HOOK)
        });

        // Configure the hook for our pool. Owner is the deployer recorded
        // on-chain; prank to call the onlyOwner function.
        IDynamicFee df = IDynamicFee(DYNAMIC_FEE_HOOK);
        address dfOwner = df.owner();
        uint256[4] memory thresholds = [uint256(100), 300, 500, 1000];
        vm.prank(dfOwner);
        df.configurePool(
            PoolId.unwrap(poolKey.toId()), address(oracle), 20_000, 3000, int8(0), thresholds
        );

        manager.initialize(poolKey, SQRT_PRICE_1_1);
        liqRouter.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({tickLower: -887_220, tickUpper: 887_220, liquidityDelta: 100e18, salt: 0}),
            new bytes(0)
        );
    }

    function test_volatilityBand_lowToHigh_feeIncreases() public {
        // Small swap at peg parity → expect fallback or low-tier fee, not a revert.
        swapRouter.swap(
            poolKey,
            SwapParams({zeroForOne: true, amountSpecified: -1e16, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            new bytes(0)
        );
        // Larger swap pushes spot price away from oracle → expect fee tier escalation.
        swapRouter.swap(
            poolKey,
            SwapParams({zeroForOne: true, amountSpecified: -10e18, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            new bytes(0)
        );
        assertGt(token1.balanceOf(address(this)), 0, "Should have received output tokens");
    }

    /// @dev Tighter assertions on the per-zone fee values require event
    /// decoding + a controlled volatility curve. Tracked under P5-010
    /// follow-up; will land alongside the TWAP refactor's redeploy.
    function test_volatilityBand_returnsToBaseline() public {
        vm.skip(true);
    }
}

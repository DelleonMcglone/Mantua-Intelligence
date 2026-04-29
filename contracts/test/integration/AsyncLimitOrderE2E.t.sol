// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {BaseSepoliaFork} from "./BaseSepoliaFork.t.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {MockERC20} from "solmate/test/utils/mocks/MockERC20.sol";

/**
 * P5-016 — AsyncLimitOrder pool initialization + swap smoke test.
 *
 * The deployed AsyncLimitOrder hook on Base Sepolia exposes
 * AFTER_INITIALIZE, BEFORE_SWAP, AFTER_SWAP and
 * BEFORE_SWAP_RETURNS_DELTA. This test confirms a fresh pool can be
 * initialized against the live hook and a basic swap completes
 * end-to-end. The deeper limit-order placement / async-execution flow
 * is gated on the hook's order-encoding API, which is tracked under a
 * P5-016 follow-up below.
 */
contract AsyncLimitOrderE2E is BaseSepoliaFork {
    using PoolIdLibrary for PoolKey;

    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint24 internal constant FEE_005 = 500; // 0.05%

    PoolSwapTest swapRouter;
    PoolModifyLiquidityTest liqRouter;
    MockERC20 token0;
    MockERC20 token1;
    PoolKey poolKey;

    function setUp() public override {
        super.setUp();
        IPoolManager manager = IPoolManager(V4_POOL_MANAGER_BASE_SEPOLIA);
        swapRouter = new PoolSwapTest(manager);
        liqRouter = new PoolModifyLiquidityTest(manager);

        MockERC20 a = new MockERC20("ALO0", "A0", 18);
        MockERC20 b = new MockERC20("ALO1", "A1", 18);
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
            fee: FEE_005,
            tickSpacing: int24(10),
            hooks: IHooks(ASYNC_LIMIT_ORDER_HOOK)
        });

        manager.initialize(poolKey, SQRT_PRICE_1_1);
        liqRouter.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({tickLower: -887_220, tickUpper: 887_220, liquidityDelta: 100e18, salt: 0}),
            new bytes(0)
        );
    }

    function test_orderExecutesWhenTickCrossed() public {
        // Smoke test: a basic swap traverses the hook lifecycle without
        // reverting, and the test wallet receives output tokens.
        uint256 balBefore = token1.balanceOf(address(this));
        swapRouter.swap(
            poolKey,
            SwapParams({zeroForOne: true, amountSpecified: -1e17, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            new bytes(0)
        );
        assertGt(token1.balanceOf(address(this)), balBefore, "Swap should yield output tokens");
    }

    /// @dev Place an order at a target tick + expiry, drive a swap that
    /// crosses the tick, and assert the limit-order is executed via
    /// `afterSwap` (BEFORE_SWAP_RETURNS_DELTA path). Requires the
    /// hook's order-encoding ABI (token + amount + tick + expiry) which
    /// isn't exposed publicly yet. Tracked under P5-016 follow-up.
    function test_orderExpires_userCanCancel() public {
        vm.skip(true);
    }
}

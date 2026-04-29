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

interface IComplianceRegistry {
    function operator() external view returns (address);
    function addToWhitelist(address account, uint256 expiry) external;
    function removeFromWhitelist(address account) external;
    function isCompliant(address account) external view returns (bool);
}

/**
 * P5-013 — RWAGate compliant / non-compliant flow.
 *
 * The deployed RWAGate hook on Base Sepolia consults the deployed
 * `ComplianceRegistry` (`0x11B261AE5AF867baA69506dfE6d62eeE9DB5D796`) to
 * gate `BEFORE_ADD_LIQUIDITY`, `BEFORE_REMOVE_LIQUIDITY`, and
 * `BEFORE_SWAP`. This test:
 *   1. Reads the on-chain operator and pranks them to whitelist the
 *      compliant test wallet.
 *   2. Initializes a fresh pool against the live RWAGate hook and adds
 *      liquidity from the compliant wallet.
 *   3. Asserts compliant wallet can swap.
 *   4. Asserts a fresh non-compliant wallet's swap reverts.
 */
contract RWAGateE2E is BaseSepoliaFork {
    using PoolIdLibrary for PoolKey;

    address internal constant COMPLIANCE_REGISTRY = 0x11B261AE5AF867baA69506dfE6d62eeE9DB5D796;
    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    PoolSwapTest swapRouter;
    PoolModifyLiquidityTest liqRouter;
    MockERC20 token0;
    MockERC20 token1;
    PoolKey poolKey;

    address compliant = makeAddr("compliant");
    address noncompliant = makeAddr("noncompliant");

    function setUp() public override {
        super.setUp();
        IPoolManager manager = IPoolManager(V4_POOL_MANAGER_BASE_SEPOLIA);
        swapRouter = new PoolSwapTest(manager);
        liqRouter = new PoolModifyLiquidityTest(manager);

        MockERC20 a = new MockERC20("RWA0", "R0", 18);
        MockERC20 b = new MockERC20("RWA1", "R1", 18);
        (token0, token1) = address(a) < address(b) ? (a, b) : (b, a);

        token0.mint(compliant, 1_000e18);
        token1.mint(compliant, 1_000e18);
        token0.mint(noncompliant, 1_000e18);
        token1.mint(noncompliant, 1_000e18);
        token0.mint(address(this), 1_000e18);
        token1.mint(address(this), 1_000e18);

        // The address(this) test contract initialises the pool + provides
        // bootstrap liquidity, so it also needs to be compliant to clear
        // the BEFORE_ADD_LIQUIDITY gate.
        IComplianceRegistry reg = IComplianceRegistry(COMPLIANCE_REGISTRY);
        address op = reg.operator();
        vm.prank(op);
        reg.addToWhitelist(compliant, 0);
        vm.prank(op);
        reg.addToWhitelist(address(this), 0);

        token0.approve(address(swapRouter), type(uint256).max);
        token1.approve(address(swapRouter), type(uint256).max);
        token0.approve(address(liqRouter), type(uint256).max);
        token1.approve(address(liqRouter), type(uint256).max);

        poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 500,
            tickSpacing: int24(10),
            hooks: IHooks(RWA_GATE_HOOK)
        });

        manager.initialize(poolKey, SQRT_PRICE_1_1);
        liqRouter.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({tickLower: -887_220, tickUpper: 887_220, liquidityDelta: 100e18, salt: 0}),
            new bytes(0)
        );
    }

    function test_compliantWallet_canTransact() public {
        vm.startPrank(compliant);
        token0.approve(address(swapRouter), type(uint256).max);
        token1.approve(address(swapRouter), type(uint256).max);
        swapRouter.swap(
            poolKey,
            SwapParams({zeroForOne: true, amountSpecified: -1e17, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            new bytes(0)
        );
        vm.stopPrank();
        assertTrue(IComplianceRegistry(COMPLIANCE_REGISTRY).isCompliant(compliant));
    }

    function test_nonCompliantWallet_blockedOnSwap() public {
        vm.startPrank(noncompliant);
        token0.approve(address(swapRouter), type(uint256).max);
        token1.approve(address(swapRouter), type(uint256).max);
        vm.expectRevert();
        swapRouter.swap(
            poolKey,
            SwapParams({zeroForOne: true, amountSpecified: -1e17, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            new bytes(0)
        );
        vm.stopPrank();
    }

    /// @dev Add-liquidity gate: a non-compliant wallet should be unable to
    /// open a position. Tracked under P5-013 follow-up; needs the
    /// PoolModifyLiquidityTest router to be invoked from the prank.
    function test_nonCompliantWallet_blockedOnAddLiquidity() public {
        vm.skip(true);
    }
}

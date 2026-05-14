// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IStateView {
    function getSlot0(bytes32 poolId)
        external
        view
        returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee);
}

/**
 * @title  SepoliaE2E
 * @notice P9-008 — broadcasts real Base Sepolia transactions across
 *         pool create / add / swap / remove for three hook configurations
 *         (no-hook, Stable Protection, Dynamic Fee).
 *
 * Run from `contracts/`:
 *   PRIVATE_KEY=<your-key> \
 *     BASE_SEPOLIA_RPC_URL=<rpc-url> \
 *     forge script script/SepoliaE2E.s.sol --broadcast --rpc-url base_sepolia
 *
 * The script:
 *   - Reads the user's private key from `PRIVATE_KEY` env (never in
 *     source). The address is derived locally and logged so the user
 *     can confirm before broadcast.
 *   - Approves USDC + EURC to the v4 routers (PoolSwapTest +
 *     PoolModifyLiquidityTest) up to MAX_UINT, idempotently.
 *   - For each pool config, reads `StateView.getSlot0` first;
 *     skips initialize if the pool already exists (so re-runs don't
 *     fail).
 *   - Uses small amounts (1 USDC + 1 EURC per add, 0.1 USDC per swap)
 *     so the user's wallet balance and the pool depth aren't dented.
 *   - Logs every tx-firing call with a one-line summary.
 *
 * The agent-side surface (`/api/agent/{swap,liquidity}`) is a
 * separate harness — see `docs/sepolia-e2e-runbook.md` for that path.
 */
contract SepoliaE2E is Script {
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant STATE_VIEW = 0x571291b572ed32ce6751a2Cb2486EbEe8DEfB9B4;
    address constant POOL_SWAP_TEST = 0x8B5bcC363ddE2614281aD875bad385E0A785D3B9;
    address constant POOL_MODIFY_LIQUIDITY_TEST = 0x37429cD17Cb1454C34E7F50b09725202Fd533039;

    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant EURC = 0x808456652fdb597867f38412077A9182bf77359F;

    address constant STABLE_PROTECTION_HOOK = 0xe5e6a9E09Ad1e536788f0c142AD5bc69e8B020C0;
    address constant DYNAMIC_FEE_HOOK = 0x9788B8495ebcEC1C1D1436681B0F56C6fc0140c0;

    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    // Tight range around current price keeps the per-add token
    // requirement small and predictable on real testnet balances.
    // ±60 ticks ≈ ±0.6% price band; the per-side raw token cost is
    // L * (sqrt(1.0001^60) - 1) ≈ L * 0.003.
    int24 internal constant TICK_LOWER = -60;
    int24 internal constant TICK_UPPER = 60;
    // L=1e7 → ~30,000 raw (= 0.03 USDC + 0.03 EURC) per add. Three
    // configs × one add = 0.09 of each token deposited per run.
    int256 internal constant LIQ_DELTA = 1e7;
    int256 internal constant LIQ_REMOVE = -5e6; // half of LIQ_DELTA

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address sender = vm.addr(pk);
        console2.log("=== Mantua Sepolia E2E ===");
        console2.log("Sender:", sender);
        console2.log("Chain id:", block.chainid);
        require(block.chainid == 84532, "must run against Base Sepolia (84532)");

        _logBalances(sender);

        vm.startBroadcast(pk);

        _approveAll();
        _runConfig({
            label: "no-hook USDC/EURC 0.01%",
            fee: 100,
            tickSpacing: 1,
            hook: address(0),
            initialPrice: SQRT_PRICE_1_1
        });
        _runConfig({
            label: "Dynamic Fee USDC/EURC",
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hook: DYNAMIC_FEE_HOOK,
            initialPrice: SQRT_PRICE_1_1
        });
        _runConfig({
            label: "Stable Protection USDC/EURC",
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hook: STABLE_PROTECTION_HOOK,
            initialPrice: SQRT_PRICE_1_1
        });

        vm.stopBroadcast();

        console2.log("");
        console2.log("=== E2E run complete ===");
        _logBalances(sender);
    }

    function _approveAll() internal {
        // Idempotent: only approve if current allowance is below a
        // sane threshold. Saves a tx on re-runs.
        address[2] memory tokens = [USDC, EURC];
        address[2] memory spenders = [POOL_SWAP_TEST, POOL_MODIFY_LIQUIDITY_TEST];
        for (uint256 i = 0; i < tokens.length; i++) {
            for (uint256 j = 0; j < spenders.length; j++) {
                uint256 current = IERC20(tokens[i]).allowance(msg.sender, spenders[j]);
                if (current < 1e18) {
                    IERC20(tokens[i]).approve(spenders[j], type(uint256).max);
                    console2.log("  approved token to spender (tx).");
                } else {
                    console2.log("  approval already in place (no tx).");
                }
            }
        }
    }

    function _runConfig(string memory label, uint24 fee, int24 tickSpacing, address hook, uint160 initialPrice)
        internal
    {
        console2.log("");
        console2.log("--- ", label, "---");

        // currency0 < currency1 sort. USDC < EURC at the byte level on Base.
        (address c0, address c1) = USDC < EURC ? (USDC, EURC) : (EURC, USDC);
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(hook)
        });

        bytes32 poolId = _poolId(key);

        // Step 1: initialize if not already.
        (uint160 existingPrice,,,) = IStateView(STATE_VIEW).getSlot0(poolId);
        if (existingPrice == 0) {
            IPoolManager(POOL_MANAGER).initialize(key, initialPrice);
            console2.log("  initialize: tx broadcast.");
        } else {
            console2.log("  initialize: pool already exists, skipping.");
        }

        // Step 2: add tight-range liquidity. Bounds get aligned to
        // tickSpacing — at spacing=60 that means [-60, 60]; at
        // spacing=1, [-60, 60] stays as-is. Tight range keeps
        // per-side raw token cost at L*0.003 ≈ 30k raw (= 0.03 of
        // each 6-decimal token).
        int24 lo = _alignTick(TICK_LOWER, tickSpacing);
        int24 hi = _alignTick(TICK_UPPER, tickSpacing);
        if (lo == hi) {
            // Edge case: spacing > 60 would collapse the range.
            // Fall back to one full spacing each side.
            lo = -tickSpacing;
            hi = tickSpacing;
        }
        PoolModifyLiquidityTest(POOL_MODIFY_LIQUIDITY_TEST).modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: lo, tickUpper: hi, liquidityDelta: LIQ_DELTA, salt: 0}),
            new bytes(0)
        );
        console2.log("  add liquidity: tx broadcast.");

        // Step 3: swap a small amount in (zeroForOne).
        PoolSwapTest(POOL_SWAP_TEST).swap(
            key,
            SwapParams({
                zeroForOne: true,
                amountSpecified: -10_000, // 0.01 USDC — well inside the 0.03 USDC of liquidity
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            new bytes(0)
        );
        console2.log("  swap forward: tx broadcast.");

        // Step 4: remove half the liquidity we just added.
        PoolModifyLiquidityTest(POOL_MODIFY_LIQUIDITY_TEST).modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: lo, tickUpper: hi, liquidityDelta: LIQ_REMOVE, salt: 0}),
            new bytes(0)
        );
        console2.log("  remove half liquidity: tx broadcast.");
    }

    function _poolId(PoolKey memory key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key));
    }

    function _alignTick(int24 tick, int24 spacing) internal pure returns (int24) {
        // Round toward zero so the bound stays inside the legal range.
        return (tick / spacing) * spacing;
    }

    function _logBalances(address who) internal view {
        console2.log("  USDC balance:", IERC20(USDC).balanceOf(who));
        console2.log("  EURC balance:", IERC20(EURC).balanceOf(who));
        console2.log("  ETH balance: ", who.balance);
    }
}

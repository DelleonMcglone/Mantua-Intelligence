// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {DynamicFee} from "../src/DynamicFee.sol";

/// @title  ConfigureDynamicFeePools
/// @notice One-time OWNER setup: create + configure the two CANONICAL-token
///         DynamicFee pools the Mantua app uses (USDC/cirBTC, EURC/cirBTC) on the
///         DynamicFee PoolManager. The hook's `configurePool` is `onlyOwner`, which
///         is why this can't be an app action — only the hook owner
///         (0xceeD79…dd56, your deployer) can call it. After this runs, the pools
///         exist + are configured; users add liquidity and swap them through the
///         app (which now routes to the DynamicFee stack).
///
/// @dev    Drop into DelleonMcglone/dynamic-fee (branch main) `script/` and run AS
///         THE HOOK OWNER with `--via-ir --optimizer-runs 200`. configurePool runs
///         before initialize (matches the repo's own CreatePools order). No token
///         transfers / no liquidity seeding here — LP happens via the app. If a
///         pool was already initialized, drop its `initialize` line (configurePool
///         is still safe to re-run).
contract ConfigureDynamicFeePools is Script {
    using PoolIdLibrary for PoolKey;

    IPoolManager constant MANAGER = IPoolManager(0x7eA87A5919C119DC95855A0BE227fd3241c998F0);
    DynamicFee constant HOOK = DynamicFee(0xA1Be807481F532c074380FCcF05be5e2A3ec80C0);

    address constant USDC = 0x3600000000000000000000000000000000000000; // 6dp (native)
    address constant EURC = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a; // 6dp
    address constant CIRBTC = 0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF; // 8dp (app canonical)

    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint64 constant TWAP_WINDOW = 1 hours;
    uint24 constant MAX_FEE = 20_000; // 2.00% ceiling
    uint24 constant FALLBACK_FEE = 3000; // 0.30% when TWAP unavailable
    int24 constant TICK_SPACING = 60;

    function run() external {
        uint256[4] memory thresholds = [uint256(100), 300, 500, 1000];
        vm.startBroadcast();
        _setup(USDC, 6, CIRBTC, 8, thresholds);
        _setup(EURC, 6, CIRBTC, 8, thresholds);
        vm.stopBroadcast();
    }

    function _setup(
        address a,
        uint8 decA,
        address b,
        uint8 decB,
        uint256[4] memory thresholds
    ) internal {
        bool aFirst = a < b;
        address c0 = aFirst ? a : b;
        address c1 = aFirst ? b : a;
        uint8 d0 = aFirst ? decA : decB;
        uint8 d1 = aFirst ? decB : decA;

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(HOOK))
        });

        int8 decimalDiff = int8(d0) - int8(d1); // dec(currency0) - dec(currency1)
        HOOK.configurePool(key.toId(), TWAP_WINDOW, MAX_FEE, FALLBACK_FEE, decimalDiff, thresholds);
        MANAGER.initialize(key, SQRT_PRICE_1_1);

        console2.log("DynamicFee pool configured + initialized:");
        console2.log("  currency0:", c0);
        console2.log("  currency1:", c1);
    }
}

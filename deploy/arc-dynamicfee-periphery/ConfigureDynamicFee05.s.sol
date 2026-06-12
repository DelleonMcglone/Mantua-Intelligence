// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {DynamicFee} from "../src/DynamicFee.sol";

/// @title  ConfigureDynamicFee05
/// @notice One-time OWNER setup: `configurePool` the **0.05% tier**
///         (tickSpacing 10) USDC/cirBTC and EURC/cirBTC DynamicFee pools.
///
///         Why this and not ConfigureDynamicFeePools: that script configured
///         the 0.30% pools but initialized them at SQRT_PRICE_1_1 (tick 0 — a
///         1:1 price, wrong for cirBTC). The pools the app actually uses (and
///         that already hold liquidity at the correct price, tick ~-64602)
///         are the **0.05%** pools — but they were never configured, so the
///         hook reverts `PoolNotConfigured(poolId)` on every swap.
///
///         These pools are ALREADY initialized + funded, so we ONLY call
///         configurePool (no MANAGER.initialize). configurePool is onlyOwner,
///         which is why this can't be an app action — run it AS THE HOOK OWNER
///         (0xceeD79…dd56) with `--via-ir --optimizer-runs 200`.
///
/// @dev    poolIds are precomputed for the canonical-token 0.05% pools:
///           USDC/cirBTC at 0.05%: 0xdb6668fbd07ad897551a3035499235a79d15517b93ab7593fbb6c8db63784413
///           EURC/cirBTC at 0.05%: 0x2424f3434cf2c56e83db202cdc75748d9c01e2d17aea17e8a2e0881b8c6b947f
///         currency0 is the stablecoin (6dp) in both, currency1 is cirBTC
///         (8dp), so decimalDiff = 6 - 8 = -2.
contract ConfigureDynamicFee05 is Script {
    DynamicFee constant HOOK = DynamicFee(0xA1Be807481F532c074380FCcF05be5e2A3ec80C0);

    uint64 constant TWAP_WINDOW = 1 hours;
    uint24 constant MAX_FEE = 20_000; // 2.00% ceiling
    uint24 constant FALLBACK_FEE = 3000; // 0.30% when TWAP unavailable
    int8 constant DECIMAL_DIFF = -2; // dec(currency0=stable,6) - dec(currency1=cirBTC,8)

    PoolId constant USDC_CIRBTC_05 =
        PoolId.wrap(0xdb6668fbd07ad897551a3035499235a79d15517b93ab7593fbb6c8db63784413);
    PoolId constant EURC_CIRBTC_05 =
        PoolId.wrap(0x2424f3434cf2c56e83db202cdc75748d9c01e2d17aea17e8a2e0881b8c6b947f);

    function run() external {
        uint256[4] memory thresholds = [uint256(100), 300, 500, 1000];
        vm.startBroadcast();
        HOOK.configurePool(USDC_CIRBTC_05, TWAP_WINDOW, MAX_FEE, FALLBACK_FEE, DECIMAL_DIFF, thresholds);
        HOOK.configurePool(EURC_CIRBTC_05, TWAP_WINDOW, MAX_FEE, FALLBACK_FEE, DECIMAL_DIFF, thresholds);
        vm.stopBroadcast();
        console2.log("Configured USDC/cirBTC + EURC/cirBTC DynamicFee pools at 0.05%");
    }
}

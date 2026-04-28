// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {BaseSepoliaFork} from "./BaseSepoliaFork.t.sol";

/**
 * On-chain baseline: each Mantua hook's bytecode is deployed at its
 * documented Base Sepolia address and its CREATE2-encoded permission
 * flags match what the hook source declares.
 *
 * This is the foundry-native counterpart to `npm run verify:hooks`
 * (which fetches via JSON-RPC + viem). Running both catches drift
 * between the off-chain registry in `verify-hooks.ts` and the
 * on-chain reality.
 */
contract HookBaseline is BaseSepoliaFork {
    function test_StableProtection_deployed() public view {
        assertGt(STABLE_PROTECTION_HOOK.code.length, 0, "StableProtectionHook not deployed");
        assertEq(
            _hookFlags(STABLE_PROTECTION_HOOK),
            FLAG_BEFORE_INITIALIZE | FLAG_BEFORE_SWAP | FLAG_AFTER_SWAP,
            "StableProtection: flag mismatch"
        );
    }

    function test_DynamicFee_deployed() public view {
        assertGt(DYNAMIC_FEE_HOOK.code.length, 0, "DynamicFeeHook not deployed");
        assertEq(
            _hookFlags(DYNAMIC_FEE_HOOK),
            FLAG_BEFORE_SWAP | FLAG_AFTER_SWAP,
            "DynamicFee: flag mismatch"
        );
    }

    function test_RWAGate_deployed() public view {
        assertGt(RWA_GATE_HOOK.code.length, 0, "RWAGateHook not deployed");
        assertEq(
            _hookFlags(RWA_GATE_HOOK),
            FLAG_BEFORE_ADD_LIQUIDITY | FLAG_BEFORE_REMOVE_LIQUIDITY | FLAG_BEFORE_SWAP,
            "RWAGate: flag mismatch"
        );
    }

    function test_AsyncLimitOrder_deployed() public view {
        assertGt(ASYNC_LIMIT_ORDER_HOOK.code.length, 0, "AsyncLimitOrderHook not deployed");
        assertEq(
            _hookFlags(ASYNC_LIMIT_ORDER_HOOK),
            FLAG_AFTER_INITIALIZE | FLAG_BEFORE_SWAP | FLAG_AFTER_SWAP | FLAG_BEFORE_SWAP_RETURNS_DELTA,
            "AsyncLimitOrder: flag mismatch"
        );
    }

    function test_PoolManager_deployed() public view {
        assertGt(
            V4_POOL_MANAGER_BASE_SEPOLIA.code.length, 0, "Uniswap v4 PoolManager not deployed at expected address"
        );
    }
}

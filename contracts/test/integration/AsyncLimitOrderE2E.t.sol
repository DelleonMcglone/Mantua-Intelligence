// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {BaseSepoliaFork} from "./BaseSepoliaFork.t.sol";

/**
 * P5-016 — Async Limit Order end-to-end test (stub).
 *
 * Plan once unblocked:
 *   1. Initialize a pool with AsyncLimitOrderHook.
 *   2. Place a limit order at a target tick + expiry (well above
 *      current price for a sell, below for a buy).
 *   3. Assert order is queued, not executed (price hasn't crossed).
 *   4. Drive a swap that crosses the target tick; assert the hook
 *      executes the limit order via `afterSwap` and emits the
 *      execution event.
 *   5. Place a second order with a near-future expiry; warp past it;
 *      attempt to cancel; assert refund-on-expiry path.
 *
 * Blocked on:
 *   - AsyncLimitOrder pool-creation route on Sepolia.
 *   - Test fixtures for the order-encoding format used by
 *     `beforeSwapReturnsDelta`.
 */
contract AsyncLimitOrderE2E is BaseSepoliaFork {
    function test_orderExecutesWhenTickCrossed() public {
        vm.skip(true);
    }

    function test_orderExpires_userCanCancel() public {
        vm.skip(true);
    }
}

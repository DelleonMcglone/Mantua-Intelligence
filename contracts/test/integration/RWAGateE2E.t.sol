// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {BaseSepoliaFork} from "./BaseSepoliaFork.t.sol";

/**
 * P5-013 — RWAGate end-to-end test (stub).
 *
 * Plan once unblocked:
 *   1. Initialize an RWA pool with RWAGateHook + the deployed
 *      ComplianceRegistry (`0x11B261AE5AF867baA69506dfE6d62eeE9DB5D796`).
 *   2. Add the test wallet to the registry's KYC list (per the P5-011
 *      decision: KYC list mechanism).
 *   3. Compliant wallet: assert add-liquidity, swap, and
 *      remove-liquidity all succeed.
 *   4. Non-compliant wallet (`makeAddr("noncompliant")`): assert the
 *      hook reverts each lifecycle action with the documented
 *      `NotCompliant` error.
 *
 * Blocked on:
 *   - P5-011: KYC-list admin path (server endpoint to add/remove
 *     addresses; or direct ComplianceRegistry admin tx for tests).
 */
contract RWAGateE2E is BaseSepoliaFork {
    function test_compliantWallet_canTransact() public {
        vm.skip(true);
    }

    function test_nonCompliantWallet_blockedOnAddLiquidity() public {
        vm.skip(true);
    }

    function test_nonCompliantWallet_blockedOnSwap() public {
        vm.skip(true);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
// RWAgate remaps v4-core/ -> lib/v4-core/ (NOT .../src/), so imports carry /src/.
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {PositionManager} from "v4-periphery/src/PositionManager.sol";
import {PositionDescriptor} from "v4-periphery/src/PositionDescriptor.sol";
import {IPositionDescriptor} from "v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IWETH9} from "v4-periphery/src/interfaces/external/IWETH9.sol";
import {StateView} from "v4-periphery/src/lens/StateView.sol";
import {V4Quoter} from "v4-periphery/src/lens/V4Quoter.sol";

/// @title  DeployRWAGatePeriphery
/// @dev    ⚠️ STATUS: BLOCKED. RWAgate's repo has mismatched v4 submodules — the
///         deployed PoolManager (0xA29B…D4Dc) was built from v4-core e50237c (older,
///         no PoolOperation.sol), but its v4-periphery 686f621 needs a NEWER core
///         (nested 59d3ecf5). Building periphery against the newer core risks an
///         ABI/storage mismatch with the deployed PoolManager. Resolve by pointing
///         at a v4-periphery whose nested core == e50237c, or redeploy RWAGate from
///         one consistent v4 version. See deploy/README.md. The body below is correct
///         in shape; only the dependency versions need reconciling.
/// @notice Deploys the missing v4 periphery (PositionManager + PositionDescriptor,
///         StateView, V4Quoter) against the RWAGate hook's existing Arc Testnet
///         PoolManager. Swaps already have PoolSwapTest
///         (0x97dA0bEf8FCa63D9B597AF54b76B25d4f89FbD14).
///
///         RWAGate is a PERMISSIONED pool — its hook calls
///         ComplianceRegistry.checkCompliance(sender) on swap/add/remove, and the
///         registry sees the ROUTER as sender. So the PositionManager deployed here
///         must be allowlisted in ComplianceRegistry
///         (0x2978eA98Cc3c5c480d4C9D073DF8599BA761556D) before it can add liquidity:
///         the registry operator runs `addToWhitelist(<PositionManager>, 0)`.
///
/// @dev    Drop into DelleonMcglone/RWAgate (branch main) `script/`. RWAGate has no
///         permit2 remapping (its own build never compiles PositionManager), so pass
///         one on the CLI. Build/run with:
///           --via-ir --optimizer-runs 200 \
///           --remappings permit2/=lib/v4-periphery/lib/permit2/
///         runs=200 keeps PositionManager + PositionDescriptor under EIP-170. No
///         token transfers, so simulation is clean. run() returns nothing on purpose.
contract DeployRWAGatePeriphery is Script {
    /// RWAGate-stack PoolManager on Arc Testnet (chainId 5042002).
    IPoolManager constant POOL_MANAGER =
        IPoolManager(0xA29B7D158f2b2113Bd60eeD765866f794096D4Dc);
    IAllowanceTransfer constant PERMIT2 =
        IAllowanceTransfer(0x000000000022D473030F116dDEE9F6B43aC78BA3);
    uint256 constant UNSUBSCRIBE_GAS_LIMIT = 300_000;

    function run() external {
        require(
            address(POOL_MANAGER).code.length > 0,
            "PoolManager has no code on this chain (wrong RPC?)"
        );

        vm.startBroadcast();

        PositionDescriptor descriptor =
            new PositionDescriptor(POOL_MANAGER, address(0), bytes32("USDC"));

        PositionManager positionManager = new PositionManager(
            POOL_MANAGER,
            PERMIT2,
            UNSUBSCRIBE_GAS_LIMIT,
            IPositionDescriptor(address(descriptor)),
            IWETH9(address(0))
        );

        StateView stateView = new StateView(POOL_MANAGER);
        V4Quoter quoter = new V4Quoter(POOL_MANAGER);

        vm.stopBroadcast();

        console2.log("PoolManager (existing):", address(POOL_MANAGER));
        console2.log("PositionDescriptor:    ", address(descriptor));
        console2.log("PositionManager:       ", address(positionManager));
        console2.log("StateView:             ", address(stateView));
        console2.log("V4Quoter:              ", address(quoter));
        console2.log("ComplianceRegistry: 0x2978eA98Cc3c5c480d4C9D073DF8599BA761556D");
        console2.log("PoolSwapTest (existing): 0x97dA0bEf8FCa63D9B597AF54b76B25d4f89FbD14");
        console2.log("!! allowlist PositionManager in ComplianceRegistry before LP !!");
    }
}

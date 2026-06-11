// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {PositionManager} from "v4-periphery/src/PositionManager.sol";
import {PositionDescriptor} from "v4-periphery/src/PositionDescriptor.sol";
import {IPositionDescriptor} from "v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IWETH9} from "v4-periphery/src/interfaces/external/IWETH9.sol";
import {StateView} from "v4-periphery/src/lens/StateView.sol";
import {V4Quoter} from "v4-periphery/src/lens/V4Quoter.sol";

/// @title  DeployAloPeriphery
/// @notice Deploys the missing v4 periphery (PositionManager + PositionDescriptor,
///         StateView, V4Quoter) against the AsyncLimitOrder (ALO) hook's existing
///         Arc Testnet PoolManager. NOTE: the ALO repo did NOT deploy a PoolSwapTest
///         or PoolModifyLiquidityTest — so swaps/liquidity for ALO pools run through
///         this PositionManager (liquidity) and need a swap router; this script also
///         deploys nothing for swaps. If you need a swap router on this PoolManager,
///         deploy PoolSwapTest separately (it lives in v4-core's test/ dir).
///
/// @dev    Drop into DelleonMcglone/limit-orders (branch master) `script/` and run
///         with `--via-ir --optimizer-runs 200`. No token transfers, so simulation
///         is clean. run() returns nothing on purpose (avoids the --broadcast
///         "encode length mismatch").
contract DeployAloPeriphery is Script {
    /// ALO-stack PoolManager on Arc Testnet (chainId 5042002).
    IPoolManager constant POOL_MANAGER =
        IPoolManager(0x95b7d2f0712f997A34c7D1b4CBaE144251CE083b);
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
    }
}

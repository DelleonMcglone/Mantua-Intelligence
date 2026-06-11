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

/// @title  DeployDynamicFeePeriphery
/// @notice Deploys the missing v4 periphery (PositionManager + PositionDescriptor,
///         StateView, V4Quoter) against the DynamicFee hook's existing Arc Testnet
///         PoolManager, so the Mantua app can add liquidity, read state, and quote
///         on the DynamicFee pools. Swaps already have PoolSwapTest
///         (0xAa096011E6604df33762d611cbBdaA0671F19Bdb).
///
/// @dev    Drop into DelleonMcglone/dynamic-fee (branch main) `script/` and run with
///         `--via-ir --optimizer-runs 200` (PositionManager needs via-ir; runs=200
///         keeps it + PositionDescriptor under the EIP-170 24576-byte limit). No
///         token transfers, so `forge script` simulation is clean. run() returns
///         nothing on purpose (a returning run() breaks --broadcast serialization).
contract DeployDynamicFeePeriphery is Script {
    /// DynamicFee-stack PoolManager on Arc Testnet (chainId 5042002).
    IPoolManager constant POOL_MANAGER =
        IPoolManager(0x7eA87A5919C119DC95855A0BE227fd3241c998F0);
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
        console2.log("PoolSwapTest (existing): 0xAa096011E6604df33762d611cbBdaA0671F19Bdb");
    }
}

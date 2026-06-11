// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";

/// @title  DeployAloSwapRouter
/// @notice The ALO (limit-orders) repo never deployed a swap router, so swaps
///         on ALO pools can't route. This deploys a v4-core PoolSwapTest against
///         the ALO PoolManager so the app's swap path has a router. (The other
///         three hooks already shipped their own PoolSwapTest.)
///
/// @dev    Drop into DelleonMcglone/limit-orders (branch master) `script/` and run
///         with `--via-ir --optimizer-runs 200`. No token transfers — simulation
///         is clean. run() returns nothing (avoids the --broadcast encode error).
contract DeployAloSwapRouter is Script {
    /// ALO-stack PoolManager on Arc Testnet (chainId 5042002).
    IPoolManager constant POOL_MANAGER =
        IPoolManager(0x95b7d2f0712f997A34c7D1b4CBaE144251CE083b);

    function run() external {
        require(
            address(POOL_MANAGER).code.length > 0,
            "PoolManager has no code on this chain (wrong RPC?)"
        );
        vm.startBroadcast();
        PoolSwapTest swapRouter = new PoolSwapTest(POOL_MANAGER);
        vm.stopBroadcast();
        console2.log("PoolManager (existing):", address(POOL_MANAGER));
        console2.log("PoolSwapTest (new):    ", address(swapRouter));
    }
}

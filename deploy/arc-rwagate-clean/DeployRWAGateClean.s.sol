// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {PositionManager} from "v4-periphery/src/PositionManager.sol";
import {PositionDescriptor} from "v4-periphery/src/PositionDescriptor.sol";
import {IPositionDescriptor} from "v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IWETH9} from "v4-periphery/src/interfaces/external/IWETH9.sol";
import {StateView} from "v4-periphery/src/lens/StateView.sol";
import {V4Quoter} from "v4-periphery/src/lens/V4Quoter.sol";
import {ComplianceRegistry} from "../src/lib/ComplianceRegistry.sol";
import {RWAGate} from "../src/RWAGate.sol";

/// @title  DeployRWAGateClean
/// @notice CLEAN redeploy of the full RWAGate stack on Arc Testnet from ONE
///         consistent v4 version, so the app's periphery (PositionManager/
///         StateView/V4Quoter) is ABI-compatible with the PoolManager. The old
///         RWAGate deployment used a v4-core (e50237c) older than its v4-periphery
///         (686f621), so periphery couldn't be built for it. This redeploys
///         everything against the periphery's own core (59d3ecf5):
///         PoolManager + ComplianceRegistry + the (ported) RWAGate hook + full
///         periphery + test routers, allowlists the routers/PositionManager, and
///         initializes the two canonical RWAGate pools (USDC/EURC, USDC/cirBTC).
///
/// @dev    Requires the one-line hook port (SwapParams/ModifyLiquidityParams now
///         imported from v4-core/src/types/PoolOperation.sol) and remappings.txt
///         pointing v4-core/ at lib/v4-periphery/lib/v4-core/. Build/run with
///         `--via-ir --optimizer-runs 200` (periphery needs via-ir; runs=200 keeps
///         it under EIP-170 while the project still compiles). Produces NEW
///         addresses for the whole RWAGate stack.
contract DeployRWAGateClean is Script {
    address constant USDC = 0x3600000000000000000000000000000000000000; // 6dp (native)
    address constant EURC = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a; // 6dp
    address constant CIRBTC = 0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF; // 8dp (app canonical)

    IAllowanceTransfer constant PERMIT2 =
        IAllowanceTransfer(0x000000000022D473030F116dDEE9F6B43aC78BA3);
    uint256 constant UNSUBSCRIBE_GAS_LIMIT = 300_000;

    // Hook flags: beforeSwap | beforeAddLiquidity | beforeRemoveLiquidity
    uint160 constant HOOK_FLAGS = uint160(
        Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
    );

    function run() external {
        vm.startBroadcast();
        address deployer = msg.sender;

        // 1. Fresh PoolManager (deployer = protocol-fee owner) + ComplianceRegistry.
        PoolManager manager = new PoolManager(deployer);
        ComplianceRegistry registry = new ComplianceRegistry(deployer);

        // 2. Mine the CREATE2 salt so the hook address encodes the flag bits.
        bytes memory creationCode =
            abi.encodePacked(type(RWAGate).creationCode, abi.encode(address(manager), address(registry)));
        bytes32 salt = _mineSalt(CREATE2_FACTORY, creationCode, HOOK_FLAGS);
        RWAGate hook = new RWAGate{salt: salt}(manager, registry);
        require(uint160(address(hook)) & Hooks.ALL_HOOK_MASK == HOOK_FLAGS, "hook flag mismatch");

        // 3. Test routers + production periphery against THIS PoolManager.
        PoolSwapTest swapRouter = new PoolSwapTest(manager);
        PoolModifyLiquidityTest lpRouter = new PoolModifyLiquidityTest(manager);
        PositionDescriptor descriptor =
            new PositionDescriptor(manager, address(0), bytes32("USDC"));
        PositionManager posm = new PositionManager(
            manager, PERMIT2, UNSUBSCRIBE_GAS_LIMIT, IPositionDescriptor(address(descriptor)), IWETH9(address(0))
        );
        StateView stateView = new StateView(manager);
        V4Quoter quoter = new V4Quoter(manager);

        // 4. Allowlist every contract the hook will see as `sender` (routers see the
        //    EOA via unlock; PositionManager is the sender for app LP), plus deployer.
        registry.addToWhitelist(address(swapRouter), 0);
        registry.addToWhitelist(address(lpRouter), 0);
        registry.addToWhitelist(address(posm), 0);
        registry.addToWhitelist(deployer, 0);

        // 5. Initialize the two canonical RWAGate pools at 1:1, fee 0.30%, ts 60.
        uint160 sqrtP = TickMath.getSqrtPriceAtTick(0);
        _initPool(manager, hook, USDC, EURC, sqrtP);
        _initPool(manager, hook, USDC, CIRBTC, sqrtP);

        vm.stopBroadcast();

        console.log("PoolManager:        ", address(manager));
        console.log("ComplianceRegistry: ", address(registry));
        console.log("RWAGate (HOOK):     ", address(hook));
        console.log("PositionManager:    ", address(posm));
        console.log("StateView:          ", address(stateView));
        console.log("V4Quoter:           ", address(quoter));
        console.log("PoolSwapTest:       ", address(swapRouter));
        console.log("PoolModifyLiqTest:  ", address(lpRouter));
    }

    function _initPool(PoolManager manager, RWAGate hook, address a, address b, uint160 sqrtP) internal {
        (Currency c0, Currency c1) = a < b ? (Currency.wrap(a), Currency.wrap(b)) : (Currency.wrap(b), Currency.wrap(a));
        PoolKey memory key = PoolKey(c0, c1, 3000, 60, IHooks(address(hook)));
        manager.initialize(key, sqrtP);
    }

    function _mineSalt(address factory, bytes memory creationCode, uint160 flags) internal pure returns (bytes32) {
        bytes32 initCodeHash = keccak256(creationCode);
        for (uint256 i; i < 200_000; ++i) {
            bytes32 salt = bytes32(i);
            address predicted =
                address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), factory, salt, initCodeHash)))));
            if (uint160(predicted) & Hooks.ALL_HOOK_MASK == flags) return salt;
        }
        revert("salt not found");
    }
}

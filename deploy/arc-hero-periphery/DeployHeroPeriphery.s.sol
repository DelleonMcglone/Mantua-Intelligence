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

/// @title  DeployHeroPeriphery
/// @notice Deploys the missing Uniswap v4 PERIPHERY — PositionManager (+ its
///         PositionDescriptor), StateView, and V4Quoter — against the
///         ALREADY-DEPLOYED Arc Testnet PoolManager that the StableProtection
///         "hero" pool (USDC/EURC) uses. This is what the Mantua app needs to
///         add liquidity (PositionManager), read pool state (StateView), and
///         quote swaps (V4Quoter). Swaps already have PoolSwapTest deployed
///         (0xeA44982cB8b71A9BF69bfe3F3f5b43E1790be4d1).
///
/// @dev    PINNED to v4-periphery commit eeb3eff28dd5f5f17aa94180fa3610ff59b0e1c8
///         (v4-core a7cf038cd568801a79a9b4cf92cd5b52c95c8585) — the EXACT version
///         vendored in DelleonMcglone/stableprotection-hook, so the periphery is
///         ABI-compatible with the deployed PoolManager 0x15B5…0a59. Drop this
///         file into that repo's `script/` directory to compile (see README).
///
///         The script performs NO token transfers (only contract deploys), so it
///         is safe under `forge script` local simulation despite Arc's native-fiat
///         transfer precompiles.
///
///         BUILD FLAGS (verified): run forge with `--via-ir --optimizer-runs 200`.
///         PositionManager needs via-ir; runs=200 keeps PositionManager +
///         PositionDescriptor under the EIP-170 24576-byte limit while still
///         letting the whole project compile under via-ir. Do NOT edit
///         foundry.toml — pass the flags on the CLI (periphery uses plain CREATE,
///         so its bytecode settings are independent of the live PoolManager).
contract DeployHeroPeriphery is Script {
    /// Existing StableProtection-stack PoolManager on Arc Testnet (chainId 5042002).
    IPoolManager constant POOL_MANAGER =
        IPoolManager(0x15B5f2c054b9DC788250131FCD1bcfCC34080a59);

    /// Canonical Permit2 — same address on every EVM chain (deterministic CREATE2).
    /// PositionManager only STORES this at construction; a missing Permit2 on Arc
    /// does not block deployment (only permit2-based approval flows would fail).
    IAllowanceTransfer constant PERMIT2 =
        IAllowanceTransfer(0x000000000022D473030F116dDEE9F6B43aC78BA3);

    /// Gas forwarded to a subscriber on unsubscribe — matches Uniswap's canonical
    /// periphery deployments.
    uint256 constant UNSUBSCRIBE_GAS_LIMIT = 300_000;

    /// @dev Returns nothing on purpose: a script `run()` that returns values
    ///      breaks Foundry's `--broadcast` serialization ("encode length
    ///      mismatch"). The deployed addresses are emitted via console2.log.
    function run() external {
        require(
            address(POOL_MANAGER).code.length > 0,
            "PoolManager has no code on this chain (wrong RPC?)"
        );

        vm.startBroadcast();

        // PositionDescriptor is cosmetic (NFT art / ratio sorting). Arc has no
        // canonical WETH, so wrappedNative = address(0); the label is the gas token.
        PositionDescriptor descriptor = new PositionDescriptor(
            POOL_MANAGER,
            address(0), // wrappedNative — no WETH on Arc
            bytes32("USDC") // native currency label (Arc gas token), cosmetic only
        );

        // WETH9 = address(0): NativeWrapper only calls it for explicit WRAP/UNWRAP
        // actions, which Arc flows never use, so address(0) is never invoked.
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

        // Copy these four addresses back into the Mantua app's V4_BY_CHAIN[arc].
        console2.log("PoolManager (existing):", address(POOL_MANAGER));
        console2.log("PositionDescriptor:    ", address(descriptor));
        console2.log("PositionManager:       ", address(positionManager));
        console2.log("StateView:             ", address(stateView));
        console2.log("V4Quoter:              ", address(quoter));
        console2.log("PoolSwapTest (existing): 0xeA44982cB8b71A9BF69bfe3F3f5b43E1790be4d1");
    }
}

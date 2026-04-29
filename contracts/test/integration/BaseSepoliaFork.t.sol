// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";

/**
 * Base Sepolia fork harness — shared setUp and on-chain hook addresses for
 * every integration test in this directory.
 *
 * Tests fork the live Base Sepolia chain at `latest` (no pinned block) so
 * a freshly-deployed hook shows up immediately. Pinning a block is
 * appropriate for tests that depend on exact pool state — add
 * `vm.createSelectFork(rpc, BLOCK)` overrides per-test as needed.
 *
 * RPC source priority:
 *   1. `BASE_SEPOLIA_RPC_URL` env var (set in `.env` or CI secrets)
 *   2. Public endpoint `https://sepolia.base.org` (rate-limited; OK for
 *      bytecode/permission-flag checks; not great for high-fanout reads)
 *
 * Run from repo root:
 *   forge test --match-path "contracts/test/integration/*.t.sol" -vv
 */
abstract contract BaseSepoliaFork is Test {
    uint256 internal constant BASE_SEPOLIA_CHAIN_ID = 84532;

    address internal constant STABLE_PROTECTION_HOOK = 0xe5e6a9E09Ad1e536788f0c142AD5bc69e8B020C0;
    address internal constant DYNAMIC_FEE_HOOK = 0x9788B8495ebcEC1C1D1436681B0F56C6fc0140c0;
    address internal constant RWA_GATE_HOOK = 0xbba7Cf860B47E16b9b83d8185878Ec0FAD0d4a80;
    address internal constant ASYNC_LIMIT_ORDER_HOOK = 0xb9E29F39bbf01c9D0FF6F1c72859F0eF550fD0c8;

    address internal constant V4_POOL_MANAGER_BASE_SEPOLIA = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;

    /// Lower 14 bits of a hook address encode its lifecycle permissions
    /// per Uniswap v4 Hooks.sol — see also contracts/script/verify-hooks.ts.
    uint16 internal constant FLAG_BEFORE_INITIALIZE = 1 << 13;
    uint16 internal constant FLAG_AFTER_INITIALIZE = 1 << 12;
    uint16 internal constant FLAG_BEFORE_ADD_LIQUIDITY = 1 << 11;
    uint16 internal constant FLAG_BEFORE_REMOVE_LIQUIDITY = 1 << 9;
    uint16 internal constant FLAG_BEFORE_SWAP = 1 << 7;
    uint16 internal constant FLAG_AFTER_SWAP = 1 << 6;
    uint16 internal constant FLAG_BEFORE_SWAP_RETURNS_DELTA = 1 << 3;

    function setUp() public virtual {
        string memory rpc = _resolveRpc();
        vm.createSelectFork(rpc);
        require(block.chainid == BASE_SEPOLIA_CHAIN_ID, "fork: not Base Sepolia");
    }

    function _resolveRpc() internal returns (string memory) {
        try vm.envString("BASE_SEPOLIA_RPC_URL") returns (string memory url) {
            if (bytes(url).length > 0) return url;
        } catch {}
        return "https://sepolia.base.org";
    }

    function _hookFlags(address hook) internal pure returns (uint16) {
        // Permission flags live in the lower 14 bits — truncation is the point.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint16(uint160(hook)) & 0x3FFF;
    }
}

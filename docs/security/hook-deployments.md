# Hook deployment verification (P5-001)

Last run: 2026-04-29T02:19:31.679Z

| Hook | Chain | Address | Deployed | Bytecode size | Bytecode hash | Permissions | Match |
|---|---|---|---|---:|---|---|---|
| `StableProtectionHook` | Base Sepolia (84532) | `0xe5e6a9E09Ad1e536788f0c142AD5bc69e8B020C0` | ✅ | 6954 B | `0x4cbabbd4a6808468…` | BEFORE_INITIALIZE, BEFORE_SWAP, AFTER_SWAP | ✅ |
| `DynamicFee` | Base Sepolia (84532) | `0x9788B8495ebcEC1C1D1436681B0F56C6fc0140c0` | ✅ | 9260 B | `0x97137149e9c06665…` | BEFORE_SWAP, AFTER_SWAP | ✅ |
| `RWAGate` | Base Sepolia (84532) | `0xbba7cf860b47e16b9b83d8185878ec0fad0d4a80` | ✅ | 4635 B | `0x3e212104923979f5…` | BEFORE_ADD_LIQUIDITY, BEFORE_REMOVE_LIQUIDITY, BEFORE_SWAP | ✅ |
| `AsyncLimitOrder` | Base Sepolia (84532) | `0xb9e29f39bbf01c9d0ff6f1c72859f0ef550fd0c8` | ✅ | 12485 B | `0xcd8786561810412f…` | AFTER_INITIALIZE, BEFORE_SWAP, AFTER_SWAP, BEFORE_SWAP_RETURNS_DELTA | ✅ |

## Pinned source commits

- `StableProtectionHook` — [DelleonMcglone/stableprotection-hook@1282b89](https://github.com/DelleonMcglone/stableprotection-hook/commit/1282b899b6f68d27e28d65194dc75661f23476af)
- `DynamicFee` — [DelleonMcglone/dynamic-fee@62710d6](https://github.com/DelleonMcglone/dynamic-fee/commit/62710d6d9b403557b073a702b5546bc10e75c0c6)
- `RWAGate` — [DelleonMcglone/RWAgate@bb41ada](https://github.com/DelleonMcglone/RWAgate/commit/bb41ada54c9c9fb5a2bea296728321f68cf2dcc1)
- `AsyncLimitOrder` — [DelleonMcglone/limit-orders@89d905f](https://github.com/DelleonMcglone/limit-orders/commit/89d905f1d39abbc3795015fc4adfb8140560194b)

## Notes

All four hooks are testnet deployments. None are on Base mainnet (8453). Re-deployment to mainnet + a fresh run of this verification is a launch-gating step (separate Phase 5 ticket).

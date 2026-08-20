# Hook deployment verification (P5-001)

Last run: 2026-08-20T23:07:23.008Z

| Hook                   | Chain                | Address                                      | Deployed | Bytecode size | Bytecode hash         | Permissions                                                      | Match |
| ---------------------- | -------------------- | -------------------------------------------- | -------- | ------------: | --------------------- | ---------------------------------------------------------------- | ----- |
| `StableProtectionHook` | Base Sepolia (84532) | `0xe5e6a9E09Ad1e536788f0c142AD5bc69e8B020C0` | ✅       |        6954 B | `0x4cbabbd4a6808468…` | BEFORE_INITIALIZE, BEFORE_SWAP, AFTER_SWAP                       | ✅    |
| `DynamicFee`           | Base Sepolia (84532) | `0x9788B8495ebcEC1C1D1436681B0F56C6fc0140c0` | ✅       |        9260 B | `0x97137149e9c06665…` | BEFORE_SWAP, AFTER_SWAP                                          | ✅    |
| `DynamicMarketHook`    | Base Sepolia (84532) | `0xff94F6319d3A67682147c997D1323D0f0B1768c0` | ✅       |        6555 B | `0x86b703e8c25bd19d…` | BEFORE_INITIALIZE, BEFORE_ADD_LIQUIDITY, BEFORE_SWAP, AFTER_SWAP | ✅    |

## Pinned source commits

- `StableProtectionHook` — [DelleonMcglone/stableprotection-hook@1282b89](https://github.com/DelleonMcglone/stableprotection-hook/commit/1282b899b6f68d27e28d65194dc75661f23476af)
- `DynamicFee` — [DelleonMcglone/dynamic-fee@62710d6](https://github.com/DelleonMcglone/dynamic-fee/commit/62710d6d9b403557b073a702b5546bc10e75c0c6)
- `DynamicMarketHook` — [DelleonMcglone/Mantua-Intelligence@07f6f16](https://github.com/DelleonMcglone/Mantua-Intelligence/commit/07f6f169fb79172c01f4a7d1dd68e9850a132ace)

## Notes

Stable Protection and Dynamic Fee are Base Sepolia testnet deployments. Neither is on Base mainnet (8453); re-deployment to mainnet + a fresh run of this verification is a launch-gating step.

# Hook deployment verification (P5-001)

Last run: 2026-05-14T00:00:00.000Z (post-MVP scope-down)

| Hook | Chain | Address | Deployed | Bytecode size | Bytecode hash | Permissions | Match |
|---|---|---|---|---:|---|---|---|
| `StableProtectionHook` | Base Sepolia (84532) | `0xe5e6a9E09Ad1e536788f0c142AD5bc69e8B020C0` | ✅ | 6954 B | `0x4cbabbd4a6808468…` | BEFORE_INITIALIZE, BEFORE_SWAP, AFTER_SWAP | ✅ |
| `DynamicFee` | Base Sepolia (84532) | `0x9788B8495ebcEC1C1D1436681B0F56C6fc0140c0` | ✅ | 9260 B | `0x97137149e9c06665…` | BEFORE_SWAP, AFTER_SWAP | ✅ |

## Pinned source commits

- `StableProtectionHook` — [DelleonMcglone/stableprotection-hook@1282b89](https://github.com/DelleonMcglone/stableprotection-hook/commit/1282b899b6f68d27e28d65194dc75661f23476af)
- `DynamicFee` — [DelleonMcglone/dynamic-fee@62710d6](https://github.com/DelleonMcglone/dynamic-fee/commit/62710d6d9b403557b073a702b5546bc10e75c0c6)

## Notes

MVP scope keeps Stable Protection (USDC/EURC only) and Dynamic Fee
(any pair) on Base Sepolia. The RWA Gate and Async Limit Order hooks
have been removed from the codebase — their on-chain deployments
still exist at the addresses recorded in prior PRs, but Mantua's
client/server no longer references them.

Both hooks are Base Sepolia testnet deployments. Neither is on Base
mainnet (8453); re-deployment to mainnet + a fresh run of this
verification is a launch-gating step. Dynamic Fee on Unichain
Sepolia is the follow-up Part 2 PR.

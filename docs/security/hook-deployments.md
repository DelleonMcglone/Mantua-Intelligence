# Hook deployment verification (P5-001)

Last run: 2026-05-14T00:00:00.000Z (post-MVP scope-down + Unichain Sepolia)

| Hook | Chain | Address | Deployed | Bytecode size | Bytecode hash | Permissions | Match |
|---|---|---|---|---:|---|---|---|
| `StableProtectionHook` | Base Sepolia (84532) | `0xe5e6a9E09Ad1e536788f0c142AD5bc69e8B020C0` | ✅ | 6954 B | `0x4cbabbd4a6808468…` | BEFORE_INITIALIZE, BEFORE_SWAP, AFTER_SWAP | ✅ |
| `DynamicFee` | Base Sepolia (84532) | `0x9788B8495ebcEC1C1D1436681B0F56C6fc0140c0` | ✅ | 9260 B | `0x97137149e9c06665…` | BEFORE_SWAP, AFTER_SWAP | ✅ |
| `DynamicFee` | Unichain Sepolia (1301) | `0xa5eCBF949D964760f3F7805f59eb4AAc1f2500c0` | ✅ | — | — | BEFORE_SWAP, AFTER_SWAP | ✅ |

## Pinned source commits

- `StableProtectionHook` — [DelleonMcglone/stableprotection-hook@1282b89](https://github.com/DelleonMcglone/stableprotection-hook/commit/1282b899b6f68d27e28d65194dc75661f23476af)
- `DynamicFee` — [DelleonMcglone/dynamic-fee@62710d6](https://github.com/DelleonMcglone/dynamic-fee/commit/62710d6d9b403557b073a702b5546bc10e75c0c6)

## Notes

MVP scope keeps Stable Protection (USDC/EURC only on Base Sepolia)
and Dynamic Fee (any pair, both Base Sepolia and Unichain Sepolia).
The RWA Gate and Async Limit Order hooks have been removed from the
codebase — their on-chain deployments still exist at the addresses
recorded in prior PRs, but Mantua's client/server no longer
references them.

Permissions for the Unichain Sepolia DynamicFee deployment are
encoded in the lower 14 bits of the CREATE2-mined address
(`0x00C0 == BEFORE_SWAP | AFTER_SWAP`), matching the Base Sepolia
deployment.

No hook is on Base Mainnet (8453); re-deployment to mainnet + a
fresh run of this verification is a launch-gating step.

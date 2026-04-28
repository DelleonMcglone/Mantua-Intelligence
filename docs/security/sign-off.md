# Security sign-off

Per-hook readiness gate. A hook ships to Base mainnet only when its row
shows **✅ on every column**.

## Status matrix

| Hook | Pinned commit | Bytecode verified | Static analysis (P5-017) | Fuzz harness (P5-024) | Fork tests (P5-025) | External audit (P5-026) | Decision |
|---|---|---|---|---|---|---|---|
| StableProtectionHook | [`1282b89`](https://github.com/DelleonMcglone/stableprotection-hook/commit/1282b899b6f68d27e28d65194dc75661f23476af) | ✅ (testnet only — see hook-deployments.md) | ⚠️ run, 7 own-M open ([findings](findings.md)) | ⬜ | ⬜ | ⬜ | ⬜ Not ready |
| DynamicFee | [`854e939`](https://github.com/DelleonMcglone/dynamic-fee/commit/854e939b6f60fae9074c263f7391b04caccc23f9) | ✅ (testnet only) | ⚠️ run, 7 own-M open ([findings](findings.md)) | ⬜ | ⬜ | ⬜ | ⬜ Not ready |
| RWAGate | [`bb41ada`](https://github.com/DelleonMcglone/RWAgate/commit/bb41ada54c9c9fb5a2bea296728321f68cf2dcc1) | ✅ (testnet only) | ⚠️ run, 0 own-M open ([findings](findings.md)) | ⬜ | ⬜ | ⬜ | ⬜ Not ready |
| AsyncLimitOrder | [`89d905f`](https://github.com/DelleonMcglone/limit-orders/commit/89d905f1d39abbc3795015fc4adfb8140560194b) | ✅ (testnet only) | ❌ compile failed ([SF-015](findings.md)) | ⬜ | ⬜ | ⬜ | ⬜ Not ready |

## Gating rules

- **Bytecode verified** → an entry exists in `hook-deployments.md` confirming the on-chain bytecode at the documented address matches the pinned source commit, on the target chain. **Note: the current entries are testnet-only.** A separate launch-gating ticket re-runs verification against Base mainnet (8453) once redeployments happen.
- **Static analysis** → Slither / mythril / semgrep findings triaged in `findings.md`; nothing Critical or High open.
- **Fuzz harness** → Foundry invariant tests committed in the hook repo; latest run green.
- **Fork tests** → mainnet-fork integration suite passes against current Base block; results recorded.
- **External audit** → audit firm sign-off attached (Spearbit / Trail of Bits / OpenZeppelin / ChainSecurity per [D-003](../decisions/v2-open-decisions.md#L57)).

A hook moves to "✅ Ready" only when its row is fully green AND the launch-gating Base mainnet verification is also recorded in `hook-deployments.md`.

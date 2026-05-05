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

---

## Testnet beta sign-off (P9-003)

> **Scope:** Base Sepolia testnet beta only. Mainnet ship gate above
> stays unchanged. This block records the security posture
> sufficient for opening the Sepolia beta to external users with
> testnet-value-only assets.

**Date:** 2026-05-05
**Reviewer:** Mantua engineering (AI-assisted via the
[Trail of Bits Claude Code skills toolkit](https://github.com/DelleonMcglone/AI-assisted-security-analysis))
**Inputs reviewed:**
- `findings.md` (P5-017 Slither baseline outputs + own-source Medium triage table)
- `slither/<hook>.{json,txt}` raw detector outputs
- `hook-deployments.md` testnet bytecode-verification entries
- v4-core / v4-periphery upstream context for the false-positive class

### Per-hook testnet beta status

| Hook | Bytecode (Sepolia) | Static analysis | Own-source Mediums | Decision |
|---|---|---|---|---|
| StableProtectionHook | ✅ verified at `0xe5e6…20C0` | ⚠️ baseline run | 7 open → all triaged below | ✅ **Testnet beta OK** |
| DynamicFee | ✅ verified at `0x9788…40c0` | ⚠️ baseline run | 7 open → all triaged below | ✅ **Testnet beta OK** |
| RWAGate | ✅ verified at `0xbba7…4a80` | ✅ clean own-source | 0 | ✅ **Testnet beta OK** |
| AsyncLimitOrder | ✅ verified at `0xb9e2…0d0c8` | ❌ compile failed (SF-015) | unknown | 🟡 **Testnet beta — advisory.** The hook is deployed and verified bytecode-wise, but Slither couldn't analyze it because the pinned `lib/v4-periphery` is missing `BaseHook.sol` (vendor-deps gap, identical root cause to the Stable Protection vendor work). The user-facing testnet flows do not yet route through ALO (per `docs/sepolia-e2e-runbook.md` "Out of scope"), so the missing analysis is not on the critical path for the beta. Promote to ✅ once SF-015 closes. |

### Residuals — accepted for testnet beta

The 14 own-source Slither Mediums (7 each on Stable Protection +
Dynamic Fee) all fall into two well-understood categories. None are
critical for testnet beta; each is logged as **Accepted-as-risk
(testnet)** below with a one-line rationale. They graduate to
require explicit fix (or audit firm sign-off) before mainnet.

**Category A — `divide-before-multiply` false positives (5 findings).**

`SF-001 / SF-002 / SF-003 / SF-004` (StableProtectionHook
`StableSwapMath.calculateD` / `getY` / `checkInvariant`),
`SF-008` (DynamicFee `_sqrtPriceX96ToPrice`).

The order of operations in each is dictated by the underlying
algorithm: StableSwap's iterative D-solver and Y-from-D math, plus
the standard `Q96 → priceE18` conversion in DynamicFee. The
intermediate division before multiplication is a deliberate
precision trade-off documented in the original StableSwap paper
and Uniswap's own `FullMath` notes. **Slither flags the pattern
mechanically; manual review confirms intent.** No security impact
expected at the magnitudes the testnet pools exercise (≤ 1k token
units per tx). Fix path for mainnet: refactor to use `FullMath.mulDiv`
where applicable, or document the precision bound explicitly.

**Category B — `unused-return` on multi-return view calls (9 findings).**

`SF-005 / SF-006 / SF-007` (StableProtection — `getSlot0` returns
4 values, `classifyZone` returns 2; the hook only needs the
sqrtPriceX96 + zone label respectively),
`SF-009 / SF-010 / SF-011 / SF-012 / SF-013 / SF-014` (DynamicFee —
mostly Chainlink `latestRoundData` + Uniswap `getSlot0` reads where
only one of multiple returns is consumed).

These are normal Solidity ergonomics — discarding tuple returns is
the standard pattern and not a security concern when the discarded
values aren't security-relevant (timestamp / round IDs that we
don't gate logic on, secondary slot fields like protocol fee that
the hook doesn't act on). **No state leaks, no missing checks.**
Fix path for mainnet: assign to named locals + `// solhint-disable
unused-vars` where appropriate; doesn't change runtime behavior.

### What this sign-off does NOT cover

- **Fuzz harness (P5-024)**, **fork tests (P5-025)**, **external
  audit (P5-026)** — all ⬜. Mainnet ship gate above is the place
  these graduate to required.
- **AsyncLimitOrder static analysis** — pending the SF-015
  vendor-deps fix. The user-facing testnet flows don't route through
  ALO yet (see `docs/sepolia-e2e-runbook.md` "Out of scope").
- **AI-assisted deeper analysis** — running the full
  [ToB skills toolkit](https://github.com/DelleonMcglone/AI-assisted-security-analysis)
  (entry-point identification, semgrep rules, property-based
  testing, malware-class checks) is the right next step before
  mainnet. Out of scope for the testnet beta gate; this sign-off
  closes only the testnet-beta-required portion of P9-003.

### What this sign-off DOES cover (testnet beta gate)

- ✅ Bytecode-verified hook deployments on Base Sepolia (all four)
- ✅ Slither baseline complete with raw outputs committed
- ✅ Own-source Medium findings triaged with explicit rationale
- ✅ False-positive classes documented for future reviewers
- ✅ Pre-mainnet escalation path documented (each accepted-as-risk
  finding has a fix path noted)

**Per the testnet beta launch gate** documented in
`docs/tasks/v2-roadmap.md` Phase 9, this is the security level
required to open the Sepolia beta to external users. P9-003
graduates to ✅ for the testnet beta scope; mainnet sign-off remains
🔴 (unchanged from the matrix at the top of this file).

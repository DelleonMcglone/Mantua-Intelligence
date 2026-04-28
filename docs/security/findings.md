# Security findings

Tracks issues raised during Phase 5 hook security review (P5-017 → P5-026).
Each finding gets an ID, severity, status, and reproducer.

## Format

```
## SF-NNN — <one-line title>

**Hook:** <hook name>
**Source:** <repo@commit, file:line>
**Severity:** Critical | High | Medium | Low | Info
**Status:** Open | In review | Accepted-as-risk | Fixed (commit) | Won't fix (rationale)
**Reporter:** <name / tool>
**Reported:** <YYYY-MM-DD>

### Description
<what's wrong>

### Reproducer
<how to trigger>

### Recommendation
<proposed fix>
```

---

## P5-017 — Slither static analysis baseline (2026-04-28)

Tool: `slither-analyzer 0.11.4` with `solc 0.8.26`. Harness:
[`contracts/script/security/run-slither.sh`](../../contracts/script/security/run-slither.sh).
Raw outputs (full detector JSON + stderr): `docs/security/slither/<hook>.{json,txt}`.

### Per-hook severity counts

| Hook | Submodule pin | Total | High | Medium | Low | Info |
|---|---|---:|---:|---:|---:|---:|
| StableProtectionHook | `1282b89` | 84 | 1 | 23 | 2 | 58 |
| DynamicFee | `854e939` | 76 | 1 | 23 | 4 | 48 |
| RWAGate | `bb41ada` | 51 | 0 | 8 | 5 | 38 |
| AsyncLimitOrder | `89d905f` | — | — | — | — | — |

**AsyncLimitOrder failed to compile** under the harness — its submodule
pins a `v4-periphery` revision missing `BaseHook.sol` (same root cause as
Phase 5b-3.2 vendor work for Stable Protection). Slither baseline pending
a submodule-deps fix; tracked in this section as a follow-up under
**SF-016** (open for P5-018+ triage).

### Own-source findings (Mantua-controlled code)

The two High findings (one in Stable Protection, one in Dynamic Fee) are
both `incorrect-exp` against `FullMath.mulDiv` in upstream Uniswap
`v4-core` — a well-known Slither false positive on Remco Bloemen's
algorithm. **No own-source High findings.**

The Medium findings below are in Mantua-controlled code (`hooks/<hook>/src/`)
and need triage in P5-018+. Each is logged here with status `Open`.

#### StableProtectionHook — 7 Medium findings, own-source

| ID | Detector | File:line |
|---|---|---|
| SF-001 | `divide-before-multiply` | `src/libraries/StableSwapMath.sol:30` (`calculateD`) |
| SF-002 | `divide-before-multiply` | `src/libraries/StableSwapMath.sol:30` (`calculateD`, second instance) |
| SF-003 | `divide-before-multiply` | `src/libraries/StableSwapMath.sol:71` (`getY`) |
| SF-004 | `divide-before-multiply` | `src/libraries/StableSwapMath.sol:137` (`checkInvariant`) |
| SF-005 | `unused-return` | `src/StableProtectionHook.sol:253` (`_getVirtualReservesNormalized` ignores 3 of 4 `getSlot0` outputs) |
| SF-006 | `unused-return` | `src/StableProtectionHook.sol:181` (`_afterSwap` ignores 1 of 2 `classifyZone` outputs) |
| SF-007 | `unused-return` | `src/StableProtectionHook.sol:228` (`currentDeviationBps` ignores 1 of 2 `classifyZone` outputs) |

#### DynamicFee — 7 Medium findings, own-source

| ID | Detector | File:line |
|---|---|---|
| SF-008 | `divide-before-multiply` | `src/DynamicFee.sol:251` (`_sqrtPriceX96ToPrice`) |
| SF-009 | `unused-return` | `src/libraries/OracleManager.sol:24` (`getOraclePrice` ignores `latestRoundData` outputs) |
| SF-010 | `unused-return` | `src/libraries/OracleManager.sol:38` (`safeGetOraclePrice`) |
| SF-011 | `unused-return` | `src/DynamicFee.sol:150` (`_computeFee` ignores `getSlot0` outputs) |
| SF-012 | `unused-return` | `src/DynamicFee.sol:176` (`afterSwap` ignores `getSlot0` outputs) |
| SF-013 | `unused-return` | `src/DynamicFee.sol:210` (`getPoolStatus`) |
| SF-014 | `unused-return` | `src/DynamicFee.sol:227` (`previewFee`) |

#### RWAGate — 0 Medium findings, own-source

All 8 RWAGate Mediums are in upstream `lib/`. No own-source Medium issues.

#### AsyncLimitOrder

| ID | Detector | File:line |
|---|---|---|
| SF-015 | (compile failure) | `src/TakeProfitsHook.sol:4` — `BaseHook` import not found in pinned `lib/v4-periphery` |

### Status legend

All P5-017 findings start as **Open**. Triage moves to:
- **In review** — owner is investigating
- **Accepted-as-risk** — known false positive (link to upstream issue / explanation) or risk explicitly accepted (with rationale)
- **Fixed** — code change merged (link to commit)
- **Won't fix** — out of scope (with rationale)

P5-018 picks up triage. P5-019 → P5-026 cover other tools (Mythril,
semgrep, Echidna fuzz, manual review, audit) and re-run after fixes.

### Note on upstream-dep findings

71 of Stable Protection's 84 detectors fire on `lib/v4-core/` and
`lib/v4-periphery/` (Uniswap upstream). These are **not Mantua's
responsibility**, but documenting them here tells reviewers we ran the
tool against the full transitive set, not just our own files. Same
ratios for Dynamic Fee (~16 dep mediums) and RWAGate (8 dep mediums).
Upstream findings are logged in the raw JSON; not transcribed above.

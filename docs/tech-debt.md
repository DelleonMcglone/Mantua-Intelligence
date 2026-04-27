# Tech debt log

Tracks gaps and shortcuts taken under deadline pressure or due to missing
infrastructure. Each entry lists the gap, why we accepted it, and the
condition for closure.

## TD-001 — No on-chain fork test for /api/positions external-positions path

**Slice:** P4e-003 (subgraph indexing of pre-Mantua positions)

**Gap:** The external-positions enrichment path (`server/src/lib/external-positions.ts`)
issues live calls to `PositionManager.getPoolAndPositionInfo` and
`getPositionLiquidity` on Base Mainnet. The PR ships with **only** unit
coverage of the `decodePositionInfo` bit-decoder
(`server/src/lib/v4-position-info.test.ts`). The subgraph fetch, the
on-chain enrichment, and the merge with DB rows have **not** been
exercised against a live wallet, a forked node, or any integration
fixture.

**Why accepted:** No Anvil/Foundry/Hardhat harness exists in the repo. Adding
one is a multi-day undertaking that would balloon the PR. Per the
on-chain test gap policy, the bare-minimum acknowledgment is documented
here in lieu of a fork test.

**Closure condition:** Stand up an Anvil mainnet-fork harness (Foundry-
based) and add an integration test that:

1. Pins to a recent Base block where a known wallet holds at least one v4
   position opened outside Mantua.
2. Mocks the subgraph response (or seeds a local subgraph) with that
   wallet's tokenIds.
3. Calls `loadExternalPositions(wallet)` and asserts the response shape
   matches the on-chain truth (ticks, liquidity, poolKey).

**Owner:** Phase 5 owner (TBD).

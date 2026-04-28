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

---

## TD-002 — Stable Protection deployment to Base Sepolia not yet executed

**Slice:** Phase 5b-3 (Stable Protection redeploy preparation)

**Gap:** [PR #25](https://github.com/DelleonMcglone/Mantua-Intelligence/pull/25)
verified that no Mantua hook lives on Base Mainnet (8453); Stable
Protection's only deployment is on Unichain Sepolia (1301). Phase 5b
pivots Mantua to Base Sepolia (84532) — Stable Protection needs to be
redeployed there too. Phase 5b-3 ships the parameterized deploy script
(`contracts/script/DeployStableProtectionBaseSepolia.s.sol`) but
does **not** run the deploy. The deployer wallet, Base Sepolia ETH,
and BaseScan API key are manual prerequisites that aren't accessible
from CI / Claude Code.

**Why accepted:** Foundry deploy with a real signer and live RPC is a
manual operator action by design. Automating it would require trusted
CI access to a Base Sepolia funded wallet — out of scope.

**Closure condition (Phase 5b-4 / PR #4):** Run the procedure in
[`contracts/script/README.md`](../contracts/script/README.md), capture
the deployed address, and ship the follow-up PR that:

1. Records the address in `server/src/lib/v4-contracts.ts` (Sepolia
   `STABLE_PROTECTION_HOOK_*` constant).
2. Re-runs `npm run verify:hooks` so Stable Protection's row in
   `docs/security/hook-deployments.md` flips from Unichain Sepolia
   (1301) to Base Sepolia (84532) ✅.
3. Updates `docs/security/sign-off.md` to mark the bytecode-verified
   column ✅ for Stable Protection on Base Sepolia.
4. Updates `contracts/README.md` hook table (remove the deprecated
   Unichain row, add the Base Sepolia row).

**Owner:** Phase 5 owner (TBD). Blocks: any Stable Protection pool
creation on Base Sepolia testnet.

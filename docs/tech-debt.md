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

---

## TD-003 — Agent-wallet provisioning has no integration test

**Slice:** P6-003 (Create & Manage Agent Wallet — server side).

**Gap:** `server/src/lib/agent-wallet.ts` (`getOrCreateAgentWallet`,
`getAgentWallet`) and the routes in `server/src/routes/agent-wallets.ts`
ship with **only** a unit test of the pure name-derivation helper
(`server/src/lib/agent-wallet.test.ts`). The orchestration —
look-up-user → check-existing → call-CDP → upsert → handle race — has
not been exercised against a real database, a fake CDP server, or any
end-to-end fixture. The route handlers' error branches
(`USER_NOT_FOUND`, `CDP_UNAVAILABLE`, the 500 path, the
`onConflictDoNothing` race) are likewise untested.

**Why accepted:** Same posture as TD-001 — there is no Anvil / mocked-CDP
harness in the repo. Adding a Postgres-backed test setup with a
fake CDP server would balloon this PR's diff well past the architectural
change it actually delivers. Per the on-chain test gap policy, the
bare-minimum acknowledgment is documented here in lieu of a real test.

**Closure condition:** Stand up an integration-test scaffold that:

1. Spins up an ephemeral Postgres (Drizzle migrations applied) and seeds
   a `users` row with a known `privyUserId`.
2. Stubs `setCdpClientForTesting(...)` with a fake `CdpClient` whose
   `evm.getOrCreateAccount` returns a deterministic address and asserts
   it was called with the derived `mantua-agent-${userId}` name.
3. Calls `getOrCreateAgentWallet` twice in sequence and asserts the
   second call returns the cached row without re-hitting the fake CDP.
4. Calls it concurrently and asserts the race path
   (`onConflictDoNothing` → re-read) returns the same row.
5. Drives the routes via `supertest` so the `requireAuth` /
   `walletRateLimiter` / `writeRateLimiter` chain is exercised, and
   asserts the four error code paths
   (`UNAUTHENTICATED` / `USER_NOT_FOUND` / `CDP_UNAVAILABLE` /
   `INTERNAL`).

**Owner:** Phase 6 owner (TBD). Blocks: nothing yet — the route is
behind `requireAuth` and CDP creds are `.optional()`, so the only way
to hit this code path on an un-set-up environment is a real
authenticated POST. Worth closing before P6-009 (autonomous mode)
starts driving the same paths from natural-language input.

---

## TD-004 — "Fund agent" + cap-management UIs do not exist in the design source

**Slice:** P6-003 (Create & Manage Agent Wallet — UI side) and P6-011
(Agent-level spending cap — UI side).

**Gap:** Two related agent-management UIs are missing from the Mantua
design source (`~/Downloads/mantua-ai/project/src/chat.jsx`):

1. **Fund Agent Wallet flow** — the P6-003 ticket calls for an explicit
   UI where a user transfers a budget from their Privy wallet into the
   agent's CDP wallet. The design has the `Fund Agent Wallet` action
   card in the chat-mode grid (line 22) but no sub-flow for what
   happens when it's clicked — the cards just call a host stub
   `window.__mantuaChatAction(a)`.
2. **Cap-management form** — P6-011 ships a server endpoint
   (`PATCH /api/agent/wallet/cap`) so a user can set their agent
   wallet's daily USD cap, but the design has no form for collecting
   that input. The current `AgentPanel.tsx` chat-mode wallet card
   sub-step _displays_ the cap (after `POST /api/agent/wallet`) but
   has no way to change it.

The codebase rule that "UI is design-driven; feature tickets never
motivate UI edits" (memory feedback) means the engineering side cannot
invent either flow.

**Why accepted:** Surfaced when scoping P6-003 (Fund) and again when
scoping P6-011 (cap form). The user signed off on splitting both
tickets: server-side ships now, UI waits for the design source. The
chat-mode wallet card is wired to `POST /api/agent/wallet` and shows
the resulting address + cap inline, but the Fund Agent Wallet card
stays inert and the cap stays at whatever value was set via API
(default $100, or whatever a manual `PATCH` set it to).

**Closure condition:**

1. Mantua design source adds:
   - A Fund-flow modal/sub-step (input amount, chosen token,
     source-wallet preview, confirmation, success).
   - A cap-edit field or modal (number input, validate against
     `HARD_DAILY_CAP_USD = $50k`, optimistic UI, error toast on 400).
2. Port the designs into `client/src/features/agent/` following the
   existing `chat.jsx` → `AgentPanel.tsx` port style.
3. The Fund transfer itself is a normal Privy-signed ERC-20 / ETH send
   to the agent wallet's address (no new server endpoint needed —
   `GET /api/agent/wallet` returns the address). Wire it through the
   existing `useConfirmedAction` seam (P1-005). The cap-edit posts to
   `PATCH /api/agent/wallet/cap`.
4. Flip P6-003 from 🟡 → ✅ in `docs/tasks/v2-roadmap.md`. P6-011 stays
   ✅ — its server-side deliverable is complete already; the UI half
   is bundled into TD-004's closure for review continuity.

**Owner:** Phase 6 / Design owner (TBD). Blocks: P6-003 cannot be marked
fully shipped; agent users have no in-app way to fund their wallet
or change the agent's cap from the schema default (they can still
fund the address manually and call the cap endpoint via cURL with
their Privy access token).

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

## TD-004 — Agent action-card sub-flows missing from the design source

**Slice:** P6-003 (Create & Manage Agent Wallet — UI side), P6-011
(Agent-level spending cap — UI side), P6-004 (Send Tokens — UI side),
P6-005 (Swap Tokens — UI side), P6-006 (Add/Remove Liquidity — UI
side), P6-007 (Query On-Chain Data — UI side), P6-008 (Portfolio
Summary — UI side + surface-placement decision).

**Gap:** Multiple agent action-card sub-flows are missing from the
Mantua design source (`~/Downloads/mantua-ai/project/src/chat.jsx`).
The design has the action _cards_ in the chat-mode grid (line 17–22)
but no sub-flow for what happens when each is clicked — the cards just
call a host stub `window.__mantuaChatAction(a)`. Affected so far:

1. **Fund Agent Wallet flow** — the P6-003 ticket calls for an explicit
   UI where a user transfers a budget from their Privy wallet into the
   agent's CDP wallet. No design exists.
2. **Cap-management form** — P6-011 ships a server endpoint
   (`PATCH /api/agent/wallet/cap`) so a user can set their agent
   wallet's daily USD cap, but the design has no form for collecting
   that input. The current `AgentPanel.tsx` chat-mode wallet card
   sub-step _displays_ the cap (after `POST /api/agent/wallet`) but
   has no way to change it.
3. **Send Tokens flow** — P6-004 ships `POST /api/agent/send` (lookup
   agent wallet → resolve token → cap check → CDP transfer →
   BaseScan tx URL) but the chat-mode "Send Tokens" card stays inert.
   Needed: recipient input, token picker, amount input, confirmation
   step (via `useConfirmedAction`), tx-success state showing the
   BaseScan link.
4. **Swap Tokens flow** — P6-005 ships `POST /api/agent/swap`
   (lookup → cap → quote → Permit2 sign → calldata → CDP-signed send
   → record). Single server-side request with no client round-trips,
   so the UI just needs an input form + result state, not the
   2-call orchestration the user-side swap uses. Needed: tokenIn /
   tokenOut pickers, amount input, optional slippage override,
   confirmation, tx-success showing input/output amounts +
   BaseScan link.
5. **Add/Remove Liquidity flow** — P6-006 ships
   `POST /api/agent/liquidity/{add,remove}`. Add does the full
   Permit2-approve-once + sign-batch + multicall(permitBatch +
   modifyLiquidities) sequence server-side, returning `tokenId` on
   success. Remove takes a `positionId` + `percentage` and reuses
   the Phase 4 remove-liquidity calldata builder. Needed: pool
   picker, amount inputs (paired or single-side), slippage override,
   confirmation, tx-success state. The Remove flow needs a position
   list pulled from `/api/positions` filtered to the agent address.
6. **Query On-Chain Data flow** — P6-007 ships
   `GET /api/agent/query?type={pools|pool|chart}`. Needed: a query
   builder UI in the chat-mode "Query On-Chain Data" sub-step that
   maps a natural-language ask ("show me top USDC pools") to one of
   the typed queries, and a result renderer (table for pools, chart
   for historical). Phase 7 (P7-001 → P7-006) will widen this
   substantially with rich query types — likely the right home for
   the UI work, with the agent's chat card delegating to that view.
7. **Portfolio Summary surface** — P6-008 ships
   `GET /api/agent/portfolio` (balances + tx history). Two open
   questions: (a) where this lives in the chat-mode UI (the design's
   action grid uses "Fund Agent Wallet" instead of Portfolio); and
   (b) what the rendering looks like — table of balances + recent
   tx list at minimum. Likely lives as a sub-step inside the Wallet
   card (P6-003), or as a route off the main app shell. Both are
   waiting on a design.

The codebase rule that "UI is design-driven; feature tickets never
motivate UI edits" (memory feedback) means the engineering side cannot
invent any of these flows.

**Why accepted:** Surfaced when scoping P6-003 (Fund), again when
scoping P6-011 (cap form), and again when scoping P6-004 (Send). The
user signed off on splitting each ticket: server-side ships now, UI
waits for the design source. The chat-mode wallet card is wired to
`POST /api/agent/wallet` and shows the resulting address + cap inline,
but the Fund / Send action cards stay inert and the cap stays at
whatever value was set via API (default $100, or whatever a manual
`PATCH` set it to).

**Closure condition:**

1. Mantua design source adds:
   - A Fund-flow modal/sub-step (input amount, chosen token,
     source-wallet preview, confirmation, success).
   - A cap-edit field or modal (number input, validate against
     `HARD_DAILY_CAP_USD = $50k`, optimistic UI, error toast on 400).
   - A Send-flow modal/sub-step (recipient address input, token
     picker, amount input, confirmation, tx-success with BaseScan
     link).
2. Port the designs into `client/src/features/agent/` following the
   existing `chat.jsx` → `AgentPanel.tsx` port style.
3. Wire the flows:
   - Fund — Privy-signed ERC-20 / ETH send to the agent address from
     `GET /api/agent/wallet`. Through `useConfirmedAction` (P1-005).
   - Cap — `PATCH /api/agent/wallet/cap`.
   - Send — `POST /api/agent/send` with `{ to, amount, token }`.
     Through `useConfirmedAction`. Show `result.explorerUrl` on
     success.
4. Flip P6-003 / P6-004 from 🟡 → ✅ in `docs/tasks/v2-roadmap.md`.
   P6-011 stays ✅ — its server-side deliverable is complete already;
   the UI half is bundled into this TD's closure for review continuity.

**Owner:** Phase 6 / Design owner (TBD). Blocks: P6-003 / P6-004
cannot be marked fully shipped; agent users have no in-app way to
fund their wallet, change the agent's cap from the schema default,
or send tokens (they can still call any of the endpoints via cURL
with their Privy access token).

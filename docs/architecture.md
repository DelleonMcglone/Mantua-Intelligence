# Mantua AI v2 — Architecture

Living document. Updated as the build progresses.

## Repository layout

```
mantua-intelligence/
├── client/                  # Vite + React 19 + TS strict + Tailwind 4 frontend
├── server/                  # Express 5 + TS + Drizzle + Zod backend
├── contracts/               # Foundry project for Uniswap v4 hooks
├── docs/
│   ├── architecture.md      # this file
│   ├── tasks/               # roadmaps, task lists
│   ├── decisions/           # decision memos
│   ├── design/              # design tokens, deviations from prototype
│   ├── promptHistory/       # notable LLM prompts and outputs
│   └── security/            # AI-assisted security analysis findings + sign-off
├── prototype/               # NOT YET — v1 prototype currently lives at repo root
│   └── (Mantua Prototype.html, src/, assets/, landing/)
└── README.md
```

The v1 prototype (`Mantua Prototype.html` + `src/` + `assets/` + `landing/`) currently lives at the repo root and is the design reference for Phase D. It will be moved into `prototype/` in a later phase if needed; until then it is read-only.

## Stack at a glance

| Layer       | Tool                                    | Why                                                |
| ----------- | --------------------------------------- | -------------------------------------------------- |
| Frontend    | Vite + React 19 + TypeScript (strict)   | Fast dev loop, strong types, broad ecosystem       |
| Styling     | Tailwind 4 + Shadcn/ui                  | Token-driven CSS, accessible primitives            |
| Auth/wallet | Privy (`@privy-io/react-auth`) + viem   | Embedded + external wallets; viem for chain calls  |
| Backend     | Express 5 + TypeScript (strict)         | Mature, predictable; no over-frameworking          |
| ORM         | Drizzle                                 | TS-first, lightweight, schema-as-code              |
| Validation  | Zod 4                                   | Runtime + compile-time guarantees at boundaries    |
| DB          | PostgreSQL (Neon planned per D-004)     | Serverless Postgres with branching for staging     |
| Contracts   | Foundry (forge / anvil / cast)          | Standard for v4 hook work                          |
| LLM         | Anthropic Claude primary, OpenAI fallback | Per D-013; provider-abstracted                   |

## Open architectural notes

- **Chain lock:** Base Mainnet only (chain ID 8453). Privy `supportedChains` and viem clients are configured with Base only; any other chain ID is rejected at the boundary.
- **Two-process dev:** `npm run dev` at the root spawns client (Vite) and server (Express) in parallel. Each has its own port. Frontend talks to backend via a base URL from env.
- **Single shared logic:** Critical Phase 3 / Phase 4 modules (swap, liquidity) are written once on the server and exposed via API endpoints; the agent (Phase 6) calls the same endpoints. No client-side duplication of swap-construction logic.

## Mainnet safety rails (Phase 1)

Server-side enforcement primitives. Every Phase 3+ write path goes through these BEFORE any Trading API or PoolManager call.

| Rail | Module | Hard ceiling | Notes |
| ---- | ------ | ------------ | ----- |
| Spending cap (P1-001) | `server/src/lib/spending-cap.ts` | $50,000/day per wallet | Reads from `user_preferences.daily_cap_usd` (primary wallet) or `agent_wallets.daily_cap_usd`. Per-day tracking in `daily_wallet_spend`. Reset at 00:00 UTC. |
| Wallet age (P1-002) | `server/src/lib/wallet-age.ts` | n/a | `recordFirstSeen` on first connection; `getWalletAge` returns `{ ageDays, tier, tierMaxCapUsd }`. Used by P1-003 cap-raise UI. |
| Slippage (P1-004) | `server/src/lib/slippage.ts` | 500 bps (5%) | `classifySlippage(bps)` returns `ok` / `warn` / `double_confirm`. Above 500 bps throws `SafetyError`. |
| Kill-switch (P1-006) | `server/src/middleware/kill-switch.ts` | n/a | Env `MANTUA_KILL_SWITCH=1` — all POST/PUT/PATCH/DELETE return 503. Reads + wallet connection unaffected. |
| Rate limit (P1-007) | `server/src/middleware/rate-limit.ts` | 100 req / 15 min IP | Tighter `writeRateLimiter` and `walletRateLimiter` for chain-touching paths. Wallet keying activates after Phase 2 auth lands. |
| Audit log (P1-008) | `server/src/lib/audit.ts` + `mantua_audit_log` table | n/a | Every write attempt logged with `(action, outcome, wallet, params, tx_hash, reason, ip, user_agent)`. Distinct from `portfolio_transactions` (which is success-only). |

The hard ceilings live in `server/src/lib/constants.ts`. Lifting any of them requires a code change + redeploy — there is no admin path for them at runtime.

`SafetyError` (`server/src/lib/errors.ts`) is the canonical thrown type for rail violations. The error code (`spending_cap_exceeded`, `slippage_too_high`, etc.) is what gets logged into `mantua_audit_log.outcome` so reviewers can grep on it.

### Deferred UI tasks

Two Phase 1 tasks are explicitly deferred to Phase D, where the UI primitives exist:

- **P1-003 (tiered cap raise UI)** — needs a Shadcn confirmation modal (PD-005) and the cap-management screen layout (PD-004). The server-side primitives (`getWalletAge`, `getDailyCap`) are ready to back it; only the UI is missing.
- **P1-005 (mandatory transaction confirmation modal)** — needs the modal primitive from PD-005. Architecturally, every Phase 3+ write path will route through a confirmation hook (`useConfirmedAction` or similar) so there is no code path from "user clicks" to "tx submitted" that skips the modal. That hook lands in PD-005.

Both deferrals are tracked in `docs/tasks/v2-roadmap.md` and revisited at the end of Phase D.

## Decision log

See `docs/decisions/v2-open-decisions.md` for the per-decision reasoning and `docs/tasks/v2-roadmap.md` for the locked task list.

## Risk acknowledgments

See the **Risk Acknowledgments** section in `docs/tasks/v2-roadmap.md`. Currently:

- **Risk 1:** EOA fee recipient at launch (mitigation: migrate to Safe multisig at \$5k revenue OR 6 months).
- **Risk 2:** No pre-launch legal review of fee collection (mitigation: post-launch counsel memo before any expansion of fee scope).

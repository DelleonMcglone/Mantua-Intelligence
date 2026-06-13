# Task — AgentKit on Arc: ERC-8004 + ERC-8183

> **Branch:** `agentkit-arc-integration`
> **Scope:** Extend the agent stack with a Coinbase AgentKit agent that runs on
> Arc testnet and exposes Arc's agent + job primitives. Isolated `agent/`
> workspace (does not touch client/server).
> **Status:** Implemented (pending review/merge).

## Decisions (confirmed)

- **Where:** new isolated `agent/` workspace in the monorepo (AgentKit needs
  zod v3; the server uses zod v4 — isolation avoids the collision).
- **Stack:** AgentKit `0.10.4` (TS) + `ViemWalletProvider`; zod `3.25.76`,
  viem `2.38.3` (AgentKit-matched).
- **cirBTC:** allowlisted using the repo's address, documented as repo-sourced
  (not in Circle's official Arc docs).

## Deliverables

- [x] Arc custom viem chain (5042002, native USDC 18-dp) — `config/arc-chain.ts`.
- [x] Env-loaded config; no hardcoded addresses — `config/env.ts`, `.env.example`.
- [x] `ViemWalletProvider` on Arc — `lib/wallet.ts`. CDP providers not registered.
- [x] Decimals 18↔6 module + tests — `lib/decimals.ts`.
- [x] Asset allowlist (USDC/EURC/cirBTC) + accept/reject tests — `config/assets.ts`.
- [x] ERC-8004 provider: register_agent_identity, read_agent_registration,
      read_agent_reputation, verify_credential — `action-providers/erc8004.ts`.
- [x] ERC-8183 provider: create_job, fund_job (USDC escrow), settle_job,
      get_job_status — `action-providers/erc8183.ts`.
- [x] `check_balances` action + low-gas warning — `action-providers/balances.ts`.
- [x] Funding runbook (Circle faucet; no test ETH; no CDP faucet) —
      `agent/docs/funding-runbook.md`.
- [x] Verified addresses + decimals decision in `docs/architecture.md`.
- [x] Tests: decimals (18↔6), allowlist accept/reject, validation failures,
      provider wiring. `npm test -w @mantua/agent` → 19 pass.

## Notes / follow-ups

- ERC-8183 role flow is multi-party (client createJob → provider setBudget →
  client approve+fund → provider submit → evaluator complete), so create and
  fund are separate actions rather than one atomic call.
- `getJob` returns an opaque tuple (components not enumerated by the explorer);
  status reads use `jobCounter`/`jobHasBudget`. Decode full job struct later if
  richer status is needed.
- Wire the AgentKit instance into an LLM loop (e.g. `getLangChainTools`) — next.
- Verify cirBTC against an official Arc source before any mainnet use.

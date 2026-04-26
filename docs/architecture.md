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

## Decision log

See `docs/decisions/v2-open-decisions.md` for the per-decision reasoning and `docs/tasks/v2-roadmap.md` for the locked task list.

## Risk acknowledgments

See the **Risk Acknowledgments** section in `docs/tasks/v2-roadmap.md`. Currently:

- **Risk 1:** EOA fee recipient at launch (mitigation: migrate to Safe multisig at \$5k revenue OR 6 months).
- **Risk 2:** No pre-launch legal review of fee collection (mitigation: post-launch counsel memo before any expansion of fee scope).

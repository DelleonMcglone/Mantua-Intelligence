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

| Layer       | Tool                                      | Why                                               |
| ----------- | ----------------------------------------- | ------------------------------------------------- |
| Frontend    | Vite + React 19 + TypeScript (strict)     | Fast dev loop, strong types, broad ecosystem      |
| Styling     | Tailwind 4 + Shadcn/ui                    | Token-driven CSS, accessible primitives           |
| Auth/wallet | Privy (`@privy-io/react-auth`) + viem     | Embedded + external wallets; viem for chain calls |
| Backend     | Express 5 + TypeScript (strict)           | Mature, predictable; no over-frameworking         |
| ORM         | Drizzle                                   | TS-first, lightweight, schema-as-code             |
| Validation  | Zod 4                                     | Runtime + compile-time guarantees at boundaries   |
| DB          | PostgreSQL (Neon planned per D-004)       | Serverless Postgres with branching for staging    |
| Contracts   | Foundry (forge / anvil / cast)            | Standard for v4 hook work                         |
| LLM         | Anthropic Claude primary, OpenAI fallback | Per D-013; provider-abstracted                    |

## Open architectural notes

- **Chain lock:** Base Mainnet only (chain ID 8453). Privy `supportedChains` and viem clients are configured with Base only; any other chain ID is rejected at the boundary. The `useBaseWalletClient` hook (`client/src/lib/privy/wallet-client.ts`) attempts an automatic chain switch and throws if the wallet remains off-Base.
- **Two-process dev:** `npm run dev` at the root spawns client (Vite, HTTPS via self-signed cert) and server (Express) in parallel. Each has its own port. Frontend talks to backend via a base URL from env.
- **HTTPS in dev:** Privy's Web Crypto API key sharding silently fails over plain HTTP outside `localhost`. The Vite dev server runs HTTPS by default via `@vitejs/plugin-basic-ssl`. The browser will warn about the self-signed cert on first load — that's expected; click through. Staging/prod use real TLS (Vercel handles this for the frontend).
- **Single shared logic:** Critical Phase 3 / Phase 4 modules (swap, liquidity) are written once on the server and exposed via API endpoints; the agent (Phase 6) calls the same endpoints. No client-side duplication of swap-construction logic.

## Auth flow (Phase 2)

1. Client renders `<MantuaPrivyProvider>` at the root with `loginMethods` per D-005, `embeddedWallets.createOnLogin: 'users-without-wallets'` per D-006, and `walletConnectCloudProjectId` per D-007.
2. User logs in via `usePrivy().login()`. Privy provisions an embedded wallet for email/Google/Apple/passkey logins, or uses the connected external wallet.
3. Client obtains an identity token via `getAccessToken()` and sends it as `Authorization: Bearer <token>` on API calls.
4. Server `attachAuth` middleware (`server/src/middleware/auth.ts`) verifies the token via `@privy-io/server-auth`, then populates `req.privyUserId` and `req.walletAddress` for downstream handlers.
5. Routes that must reject anonymous traffic chain `requireAuth` after `attachAuth`.

`req.walletAddress` is what `walletRateLimiter` (P1-007) keys on once auth is wired into write paths.

## CDP agent wallet (Phase 6)

### Wallet boundary (D-008 — confirmed P6-000, 2026-04-30)

Mantua runs **two wallets per user**, owned by different actors:

| Wallet                | Owner     | Holds                    | Signing rights               | Funded by                                  |
| --------------------- | --------- | ------------------------ | ---------------------------- | ------------------------------------------ |
| Privy embedded wallet | The user  | The user's primary funds | User only (Privy auth)       | User's existing on-ramp                    |
| CDP agent wallet      | The agent | A user-set budget        | Agent only (CDP-managed key) | User explicitly transfers from Privy → CDP |

**Hard rule:** the agent never holds, sees, or can sign with the Privy wallet's keys. There is no path in code that lets the agent move funds out of the Privy wallet. The user funds the agent by sending tokens from Privy to CDP — this is the only direction funds cross the boundary, and it always requires the user's signature on the Privy side.

**Why** (full rationale in `docs/decisions/v2-open-decisions.md` D-008): an autonomous LLM-driven actor must not have signing rights over the user's primary funds. Bounding the agent's blast radius to a separately-funded CDP wallet means the worst case from any agent bug, prompt injection, or misparsed instruction is loss of the agent's budget — not the user's main holdings. Mental model: Zapier doesn't get your Gmail password.

**Spending caps stack at the wallet, not the user.** The user's Privy wallet has its own daily cap (D-009 / P1-001). The agent's CDP wallet has its own, independent cap (P6-011) that the user sets when funding the agent. Caps are enforced server-side in `server/src/lib/spending-cap.ts` against `daily_wallet_spend` keyed on the wallet address — the cap doesn't know which wallet is "primary" and which is "agent," and that's intentional.

**Recovery.** If the user wants to "unfund" the agent, they sweep the CDP wallet back to their Privy wallet. The CDP wallet is not destroyed — it just sits empty, ready to be re-funded. There is no protocol-level concept of "deleting an agent."

### Implementation path

The chosen implementation path for P6-003 (Create & Manage Agent Wallet) is the [`create-onchain-agent`](https://www.npmjs.com/package/create-onchain-agent) scaffolder, which bootstraps an AgentKit-based wallet with the wallet-secret and policy-management plumbing already wired. The bare `@coinbase/cdp-sdk` direct path is **not** used for v2 — the AgentKit scaffold gives us spending policies, EIP-7702 delegation, and a coherent end-user-management story for free.

Phase 2 only stores the CDP API credentials in env (`CDP_PROJECT_ID`, `CDP_API_KEY_NAME`, `CDP_API_KEY_PRIVATE_KEY`, `CDP_WALLET_SECRET`). Wallet provisioning happens in Phase 6.

## Mainnet safety rails (Phase 1)

Server-side enforcement primitives. Every Phase 3+ write path goes through these BEFORE any Trading API or PoolManager call.

| Rail                  | Module                                               | Hard ceiling           | Notes                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spending cap (P1-001) | `server/src/lib/spending-cap.ts`                     | $50,000/day per wallet | Reads from `user_preferences.daily_cap_usd` (primary wallet) or `agent_wallets.daily_cap_usd`. Per-day tracking in `daily_wallet_spend`. Reset at 00:00 UTC.          |
| Wallet age (P1-002)   | `server/src/lib/wallet-age.ts`                       | n/a                    | `recordFirstSeen` on first connection; `getWalletAge` returns `{ ageDays, tier, tierMaxCapUsd }`. Used by P1-003 cap-raise UI.                                        |
| Slippage (P1-004)     | `server/src/lib/slippage.ts`                         | 500 bps (5%)           | `classifySlippage(bps)` returns `ok` / `warn` / `double_confirm`. Above 500 bps throws `SafetyError`.                                                                 |
| Kill-switch (P1-006)  | `server/src/middleware/kill-switch.ts`               | n/a                    | Env `MANTUA_KILL_SWITCH=1` — all POST/PUT/PATCH/DELETE return 503. Reads + wallet connection unaffected.                                                              |
| Rate limit (P1-007)   | `server/src/middleware/rate-limit.ts`                | 100 req / 15 min IP    | Tighter `writeRateLimiter` and `walletRateLimiter` for chain-touching paths. Wallet keying activates after Phase 2 auth lands.                                        |
| Audit log (P1-008)    | `server/src/lib/audit.ts` + `mantua_audit_log` table | n/a                    | Every write attempt logged with `(action, outcome, wallet, params, tx_hash, reason, ip, user_agent)`. Distinct from `portfolio_transactions` (which is success-only). |

The hard ceilings live in `server/src/lib/constants.ts`. Lifting any of them requires a code change + redeploy — there is no admin path for them at runtime.

`SafetyError` (`server/src/lib/errors.ts`) is the canonical thrown type for rail violations. The error code (`spending_cap_exceeded`, `slippage_too_high`, etc.) is what gets logged into `mantua_audit_log.outcome` so reviewers can grep on it.

### Deferred UI tasks

Two Phase 1 tasks are explicitly deferred to Phase D, where the UI primitives exist:

- **P1-003 (tiered cap raise UI)** — needs a Shadcn confirmation modal (PD-005) and the cap-management screen layout (PD-004). The server-side primitives (`getWalletAge`, `getDailyCap`) are ready to back it; only the UI is missing.
- **P1-005 (mandatory transaction confirmation modal)** — superseded by Phase D's `useConfirmedAction` hook (see below).

Both deferrals are tracked in `docs/tasks/v2-roadmap.md` and revisited at the end of Phase D.

## Phase D — design system

The v1 prototype (`Mantua Prototype.html`) is the design spec. Phase D extracts it into a reusable system before feature phases build UIs on top.

| Artifact           | Path                                                          |
| ------------------ | ------------------------------------------------------------- |
| Constraint capture | `docs/design/notes.md`                                        |
| Token source       | `client/src/styles/tokens.css` (CSS vars)                     |
| Tailwind 4 binding | `client/src/index.css` (`@theme inline`)                      |
| Component mapping  | `docs/design/components.md`                                   |
| Shell scaffold     | `client/src/components/shell/{AppShell,Header,Logo,Card}.tsx` |
| Confirmation seam  | `client/src/hooks/use-confirmed-action.tsx`                   |
| Theme toggle       | `client/src/hooks/use-theme.tsx` (`html[data-theme]`)         |

### Deviations from the prototype

PD-007 — things the prototype shows differently from how v2 will ship, with rationale.

- **Responsive design.** The prototype hard-locks `<meta viewport width=1400>`. v2 must support mobile. Added our own breakpoints in `docs/design/notes.md`. Right-column slide-in sheet (mobile) lands as a Phase D follow-up when the first feature actually needs it.
- **Onboarding modal removed.** The four-screen welcome carousel from the prototype was dropped per design feedback (PR [#1](https://github.com/DelleonMcglone/Mantua-Intelligence/pull/1)). v2 lands users on the login screen directly. The login screen reuses the welcome modal's visual style.
- **Self-signed HTTPS in dev.** Privy needs a secure context. Added `@vitejs/plugin-basic-ssl`. Browser shows a one-time cert warning. (Documented earlier, not a Phase D-specific deviation.)
- **Focus-visible rings.** Prototype doesn't show keyboard focus. v2 adds a 2px accent-purple ring on every `:focus-visible` (in `client/src/index.css`) per WCAG 2.1 AA.
- **Density settings location.** Prototype exposes density in the Settings panel. v2 also persists it in the Settings panel; the underlying mechanism is `html[data-density]` driven by a `useTheme`-style hook (lands when the Settings panel is built, Phase 6).
- **Self-hosted fonts (planned).** Prototype + v2 currently load Inter + JetBrains Mono via Google Fonts. Phase 9 moves them to Vercel-edge fonts to drop the third-party fetch and tighten CSP.
- **Network dropdown shows only Base.** The prototype renders a multi-network picker; we render the same control for visual consistency, but only Base is selectable (chain-lock).

### Confirmation modal seam (P1-005)

The `useConfirmedAction` hook is the single architectural seam between any UI button click and an on-chain transaction. Every Phase 3+ write path MUST call `confirm()` and wait for user assent before executing. Lint rule incoming in Phase 9 to reject any direct call to swap/LP modules outside a confirmed-action context.

```tsx
const confirm = useConfirmedAction();
const ok = await confirm({
  title: "Swap 0.5 ETH for USDC",
  description: "Expected output: 1,815.42 USDC. Slippage 0.5%.",
  doubleConfirm: slippageBps >= 100, // P1-004 calls for double-confirm at ≥1%
});
if (!ok) return;
await submitSwap(...);
```

## Decision log

See `docs/decisions/v2-open-decisions.md` for the per-decision reasoning and `docs/tasks/v2-roadmap.md` for the locked task list.

## Risk acknowledgments

See the **Risk Acknowledgments** section in `docs/tasks/v2-roadmap.md`. Currently:

- **Risk 1:** EOA fee recipient at launch (mitigation: migrate to Safe multisig at \$5k revenue OR 6 months).
- **Risk 2:** No pre-launch legal review of fee collection (mitigation: post-launch counsel memo before any expansion of fee scope).

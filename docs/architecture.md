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

## Phase D — design system

The v1 prototype (`Mantua Prototype.html`) is the design spec. Phase D extracts it into a reusable system before feature phases build UIs on top.

| Artifact | Path |
| --- | --- |
| Constraint capture | `docs/design/notes.md` |
| Token source | `client/src/styles/tokens.css` (CSS vars) |
| Tailwind 4 binding | `client/src/index.css` (`@theme inline`) |
| Component mapping | `docs/design/components.md` |
| Shell scaffold | `client/src/components/shell/{AppShell,Header,Logo,Card}.tsx` |
| Confirmation seam | `client/src/hooks/use-confirmed-action.tsx` |
| Theme toggle | `client/src/hooks/use-theme.tsx` (`html[data-theme]`) |

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

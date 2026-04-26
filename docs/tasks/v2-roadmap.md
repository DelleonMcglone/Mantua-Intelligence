# Mantua AI v2 - Base Mainnet Task List

> **Build:** Full rebuild from scratch
> **Network:** Base Mainnet (Chain ID: 8453) ONLY
> **Launch:** Public mainnet launch — no allowlist gating
> **Design:** Full UI/UX overhaul — see design files (`Mantua Prototype.html` + README) for the authoritative spec. The old Hyperliquid-inspired teal (#14b8a6) palette from v1 is superseded.
> **Last Updated:** 2026-04-26 (decisions locked: D-002 hooks override, D-003 AI security analysis, D-004–D-010/D-013/D-014 accepted, D-011/D-012 risk-accepted)

---

## 🎯 OVERHAUL OBJECTIVE

Rebuild Mantua AI from scratch as a production-grade, AI-powered DeFi platform on Base Mainnet. Every feature must work end-to-end with verifiable on-chain transactions. No placeholders. No TODOs. Test everything. Mainnet-safe from day one.

---

## 🔗 Supported Network

| Network | Chain ID | Status | Block Explorer |
|---------|----------|--------|----------------|
| Base Mainnet | 8453 | 🚧 To build | https://basescan.org/ |

**No testnets.** All development against mainnet forks (Anvil) during dev; real mainnet for staging/prod.

---

## 🪙 Supported Tokens (Base Mainnet)

| Token | Symbol | Address | Decimals | CoinGecko ID |
|-------|--------|---------|----------|--------------|
| Ethereum | ETH | Native (0x0) | 18 | ethereum |
| Coinbase Wrapped BTC | cbBTC | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` | 8 | coinbase-wrapped-btc |
| USD Coin | USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 | usd-coin |
| Euro Coin | EURC | `0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42` | 6 | euro-coin |
| Chainlink | LINK | `0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196` | 18 | chainlink |

> ⚠️ Token addresses above are Base Mainnet canonical addresses — verify each against the issuer's official docs before hardcoding (P1-002). LINK sourced from Chainlink's [LINK Token Contracts](https://docs.chain.link/resources/link-token-contracts#base-mainnet) page.

---

## 🔑 Required Credentials

```env
# Privy (wallet + auth provider) — D-005, D-006 ACCEPTED
VITE_PRIVY_APP_ID=<your_privy_app_id>
PRIVY_APP_SECRET=<your_privy_app_secret>  # Server-side only, never expose to client

# WalletConnect — D-007 ACCEPTED: required for mobile external wallets via Privy
VITE_WALLETCONNECT_PROJECT_ID=<your_walletconnect_project_id>

# Uniswap Trading API
UNISWAP_TRADING_API_KEY=<your_uniswap_api_key>

# Coinbase Developer Platform (Agent wallets) — D-008 ACCEPTED: separate from Privy embedded wallet
CDP_PROJECT_ID=<your_cdp_project_id>
CDP_API_KEY_NAME=<your_cdp_key_name>
CDP_API_KEY_PRIVATE_KEY=<your_private_key>  # Never commit!

# DefiLlama MCP
DEFILLAMA_API_KEY=<your_defillama_api_key>  # If required by MCP

# LLM for natural-language command bar (Phase N) — D-013 ACCEPTED: Anthropic primary, OpenAI fallback
ANTHROPIC_API_KEY=<your_anthropic_api_key>    # Primary
OPENAI_API_KEY=<your_openai_api_key>          # Fallback for availability

# Mantua fee configuration (Phase F) — D-010 ACCEPTED: 10 bps default, MAX_FEE_BPS=25
MANTUA_FEE_BPS=10                             # Default 10 = 0.10%, hard cap 25
MANTUA_FEE_RECIPIENT=<eoa_address>            # EOA at launch (see Risk 1); migrate to multisig per mitigation plan
MANTUA_FEE_ADMIN_KEY=<admin_key_for_fee_updates>  # Server-side only

# Database
DATABASE_URL=<your_postgres_url>
```

---

## 🛠️ Required Skills & SDKs

| Tool | Install Command | Purpose |
|------|-----------------|---------|
| Privy React Auth | `npm i @privy-io/react-auth` | Wallet + auth (embedded + external) |
| Uniswap AI (swap-integration) | `npx skills add uniswap/uniswap-ai --skill swap-integration` | Swaps & LP via Trading API |
| Coinbase agentic-wallet | `npx skills add coinbase/agentic-wallet-skills` | Agent wallets & autonomous actions |
| DefiLlama MCP | Follow `https://raw.githubusercontent.com/DefiLlama/defillama-skills/refs/heads/master/defillama-setup/SKILL.md` | Protocol analytics |
| wagmi + viem | `npm i wagmi viem` | Web3 hooks (used alongside Privy) |
| Foundry | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` | Hook deployment |

---

## 📊 Overall Progress

```
Total Tasks: 143
Completed:   0

[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0%
```

| Phase | Tasks | Done | Progress |
|-------|-------|------|----------|
| 🧱 Phase 0: Project Bootstrap | 8 | 0 | `░░░░░░░░░░` 0% |
| 🎨 Phase D: Design System & UI Shell | 8 | 0 | `░░░░░░░░░░` 0% |
| 🛡️ Phase 1: Mainnet Safety | 8 | 0 | `░░░░░░░░░░` 0% |
| 🔌 Phase 2: Skill, MCP & Wallet Provider Integration | 16 | 0 | `░░░░░░░░░░` 0% |
| 💱 Phase 3: Swap (Core) | 8 | 0 | `░░░░░░░░░░` 0% |
| 💧 Phase 4: Liquidity (Add & Remove) | 10 | 0 | `░░░░░░░░░░` 0% |
| 🪝 Phase 5: Hook Integration + AI Security Analysis | 26 | 0 | `░░░░░░░░░░` 0% |
| 🤖 Phase 6: Agent (Chat + Autonomous) | 13 | 0 | `░░░░░░░░░░` 0% |
| 📊 Phase 7: DefiLlama Analytics | 6 | 0 | `░░░░░░░░░░` 0% |
| 💼 Phase 8: Portfolio Page | 7 | 0 | `░░░░░░░░░░` 0% |
| 💰 Phase F: LP & Mantua Fee | 10 | 0 | `░░░░░░░░░░` 0% |
| 🗣️ Phase N: Natural Language Command Bar | 11 | 0 | `░░░░░░░░░░` 0% |
| ✅ Phase 9: E2E Testing & Launch | 12 | 0 | `░░░░░░░░░░` 0% |

---

## ❌ Out of Scope (v2)

| Feature | Reason |
|---------|--------|
| Voice Commands (Whisper) | Dropped — text NLP only |
| Base Sepolia / Unichain Sepolia | Mainnet only |
| Mock Tokens (mUSDC, mETH, etc.) | Real tokens only |
| Prediction Markets | Not in v2 scope |
| Vaults | Not in v2 scope |
| Custom Faucet UI | No faucets on mainnet |
| Dune MCP | Replaced by DefiLlama |

---

## ⚠️ Open Decisions (Block Later Phases)

| ID | Decision | Blocks | Status |
|----|----------|--------|--------|
| D-004 | Hosting target: Vercel (FE) + Railway/Fly (BE) + Neon (DB) | Phase 9 | ✅ ACCEPTED |
| D-005 | Privy login methods: email + Google + Apple + passkey + external wallet (no SMS) | Phase 2 | ✅ ACCEPTED |
| D-006 | Privy embedded wallets: `createOnLogin: 'users-without-wallets'` | Phase 2 | ✅ ACCEPTED |
| D-007 | WalletConnect enabled (required, not optional) | Phase 2 | ✅ ACCEPTED |
| D-008 | Separate CDP agent wallet (Privy embedded wallet stays user's primary) | Phase 6 | ✅ ACCEPTED |
| D-009 | Per-wallet daily spending cap: $500 default, tiered raise by account age | Phase 1 | ✅ ACCEPTED |
| D-010 | Mantua fee: 10 bps default; `MAX_FEE_BPS` capped at 25 | Phase F | ✅ ACCEPTED |
| D-013 | LLM provider: Anthropic primary, OpenAI fallback | Phase N | ✅ ACCEPTED |
| D-014 | Intent confidence: ≥0.85 execute / 0.65–0.85 clarify / <0.65 reject | Phase N | ✅ ACCEPTED |

### Decisions Closed (Reference)
- ~~D-001~~: allowlist removed (public launch)
- ~~D-002~~: all four hooks deploy to Base Mainnet (overrides "Stable Protection only" memo recommendation)
- ~~D-003~~: external audit firm replaced by AI-assisted security analysis methodology — see Phase 5 audit tasks
- ~~D-011~~: fee recipient out of scope — using EOA at launch (see ⚠️ Risk Acknowledgments)
- ~~D-012~~: legal review out of scope at launch (see ⚠️ Risk Acknowledgments)

---

## ⚠️ Risk Acknowledgments

The following risks have been accepted by the project owner and are documented here to ensure they are not forgotten:

### Risk 1: EOA Fee Recipient (was D-011)
**Decision:** Mantua fee revenue collected to an EOA (single private key) at launch, not a multisig.
**Risk surface:** Compromise of the recipient private key results in loss of all accumulated fee revenue with no recovery. Standard wallet hygiene applies (hardware wallet strongly recommended; secure backup of seed phrase; never expose key to development environments).
**Mitigation plan:** Migrate to Safe multisig (2-of-3 minimum, 3-of-5 preferred) when (a) accumulated revenue exceeds $5,000, OR (b) within 6 months of launch, whichever comes first. Track in `docs/architecture.md`.

### Risk 2: No Pre-Launch Legal Review (was D-012)
**Decision:** Mantua fee collection (`portionBips > 0`) ships without a pre-launch crypto-counsel review.
**Risk surface:** Taking fees on mainnet may classify Mantua as a money transmitter, exchange, or broker depending on jurisdiction (US FinCEN/state MTL, EU MiCA, UK FCA, etc.). Operating without proper licensing carries enforcement risk.
**Mitigation plan:** Engage crypto counsel post-launch for a written memo on jurisdictional posture before any expansion of fee scope (variable fee tiers, additional fee streams, fiat ramps). Geofencing of high-risk jurisdictions to be considered if counsel recommends.

---

## 🧱 PHASE 0: Project Bootstrap

> Fresh repo. Per development standards: `.gitignore` first, pinned deps, no secrets.

| ID | Task | Status |
|----|------|--------|
| P0-001 | Initialize git repo, create `.gitignore` (node_modules, .env, dist, foundry out/, cache/) | ⬜ |
| P0-002 | Create `docs/` scaffold (tasks/, promptHistory/, architecture.md) | ⬜ |
| P0-003 | Initialize Vite + React 19 + TypeScript (strict mode) + TailwindCSS | ⬜ |
| P0-004 | Configure Shadcn/ui components per design system tokens (colors, spacing, typography from Mantua Prototype) | ⬜ |
| P0-005 | Initialize Express + TypeScript backend, Drizzle ORM, Zod validation | ⬜ |
| P0-006 | Set up PostgreSQL schema: `users`, `user_preferences`, `chat_sessions`, `chat_messages`, `portfolio_transactions`, `positions`, `pools`, `agent_wallets` | ⬜ |
| P0-007 | Initialize Foundry project in `contracts/` for hook work | ⬜ |
| P0-008 | Set up ESLint + Prettier + Husky pre-commit hooks (lint + typecheck) | ⬜ |

### P0-001 Details
- Pin **all** dependencies to exact versions in `package.json` (no `^` or `~`)
- Verify each package has >1000 weekly downloads before installing
- Template `.env.example` committed; real `.env` ignored

### P0-006 Details: Core Tables
```sql
CREATE TABLE pools (
  id UUID PRIMARY KEY,
  pool_key_hash VARCHAR(66) UNIQUE,
  token0 VARCHAR(42) NOT NULL,
  token1 VARCHAR(42) NOT NULL,
  fee INT NOT NULL,
  tick_spacing INT NOT NULL,
  hook_address VARCHAR(42),
  hook_type VARCHAR(32),  -- 'none' | 'stable' | 'dynamic_fee' | 'rwa_gate' | 'alo'
  created_tx VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🛡️ PHASE 1: Mainnet Safety

> ⚠️ This phase did not exist in the testnet build. It must ship before **any** mainnet swap or LP action. These rails are especially important on public launch — there's no allowlist backstop.

| ID | Task | Status |
|----|------|--------|
| P1-001 | Per-wallet daily spending cap: $500/day default at account creation, hard ceiling $50k/day in code (cannot be exceeded by any user action) | ⬜ |
| P1-002 | Account-age tracking: store `first_seen_at` timestamp per wallet on first connection; expose via `getWalletAge(address)` server util | ⬜ |
| P1-003 | Tiered cap raise UI: Day 0–30 cap locked at $500 (user can lower only); Day 31–90 user can raise to $10k with double-confirmation; Day 91+ user can raise to $50k with double-confirmation; cap reductions never require confirmation | ⬜ |
| P1-004 | Slippage protection: enforce max slippage 1% default, hard cap 5% — reject higher | ⬜ |
| P1-005 | Transaction confirmation modal mandatory for all on-chain ops (no 1-click execution) | ⬜ |
| P1-006 | Global kill-switch: env var `MANTUA_KILL_SWITCH=1` disables all write operations | ⬜ |
| P1-007 | Rate limiting on all API endpoints (per-IP and per-wallet) | ⬜ |
| P1-008 | Audit log table: every mainnet tx attempt logged with wallet, action, params, outcome | ⬜ |

### P1-001 Details: Spending Cap Implementation
- Cap is enforced server-side before any swap/LP transaction is forwarded to the Trading API.
- USD equivalent calculated using DefiLlama prices at time of transaction.
- Cap resets at 00:00 UTC daily.
- Cap is per-wallet, not per-user — agent wallets get their own cap (separate from the user's primary wallet).
- The $50k absolute ceiling is a hard constant; no admin endpoint can raise it. Lifting the ceiling requires a code change + redeploy.

### P1-004 Details: Slippage Enforcement
- User-facing default: 0.5%
- User can raise to 1% with warning
- User can raise to 1–5% with double-confirmation modal
- Above 5%: **hard reject** — do not let user submit
- Uniswap Trading API `autoSlippage` enabled by default; override only on explicit user action

### P1-006 Details: Kill-Switch Semantics
- READ operations (quotes, balances, analytics) remain available
- WRITE operations (swap, add/remove LP, agent actions) return 503 with user-facing message
- Wallet connection remains available
- Intended for incident response, not daily ops

---

## 🎨 PHASE D: Design System & UI Shell

> **Source of truth:** `Mantua Prototype.html` + accompanying README in the design files. The prototype defines the target look, component patterns, and interaction model. This phase extracts that into a reusable system before feature phases start building UIs.
>
> **Order:** Runs in parallel with Phase 0 where possible; must complete before Phase 3 (Swap UI) begins. P0-004 (Shadcn config) depends on PD-002.

| ID | Task | Status |
|----|------|--------|
| PD-001 | Fetch design file: `Mantua Prototype.html` — prototype is the design spec (no README in package). If non-obvious constraints arise during extraction (responsive breakpoints, accessibility rules, chain-lock behavior), capture them in `docs/design/notes.md`. | ⬜ |
| PD-002 | Extract design tokens from prototype: color palette, typography scale, spacing, radii, shadows — publish to `src/styles/tokens.css` as CSS variables + Tailwind config | ⬜ |
| PD-003 | Map prototype components to Shadcn/ui primitives; document which Shadcn components need custom variants to match the prototype | ⬜ |
| PD-004 | Build app shell: sidebar, top bar, content area — match prototype layout, including responsive collapse behavior | ⬜ |
| PD-005 | Build shared components used across features: token selector, amount input with MAX button, transaction status toast, confirmation modal, loading skeleton — match prototype | ⬜ |
| PD-006 | Implement Privy login screen styled to match prototype (D-005 login methods wired once decided) | ⬜ |
| PD-007 | Document any deviations from the prototype (things we intentionally won't ship as-drawn) in `docs/architecture.md` with rationale | ⬜ |
| PD-008 | Visual QA: side-by-side comparison of each built page against the prototype; capture screenshots in `docs/design/` | ⬜ |

### Design Phase Rules
1. **The prototype is the spec.** If the prototype and this task list conflict on UI details, the prototype wins — flag the conflict and update the task list.
2. **No custom CSS without a token.** Every color, spacing value, and font size traces back to a token published in PD-002. Ad-hoc hex codes or `px` values are a lint failure.
3. **Dark/light mode behavior follows the prototype.** If the prototype is dark-only, ship dark-only — don't speculatively add a light theme.
4. **Old v1 palette is dead.** The teal `#14b8a6` accent from v1 Portfolio redesign does not carry over unless the new prototype happens to use it.
5. **Accessibility baseline:** WCAG 2.1 AA — focus states, contrast ratios, keyboard nav — even if the prototype doesn't show them explicitly.

### Feature-Phase Design Handoff
Each feature phase (Swap, Liquidity, Agent, Portfolio) must reference the relevant prototype screens before implementation:
- Phase 3 (Swap) → prototype swap screen + confirmation flow
- Phase 4 (Liquidity) → prototype liquidity list + add/remove modals
- Phase 6 (Agent) → prototype agent mode selection + chat interface
- Phase 8 (Portfolio) → prototype portfolio layout (replaces old Hyperliquid-inspired three-column design from v1)

---

## 🔌 PHASE 2: Skill, MCP & Wallet Provider Integration

> Install the external tools and wallet provider. Verify each works end-to-end in isolation before building features on top.

| ID | Task | Status |
|----|------|--------|
| P2-001 | Run `npx skills add uniswap/uniswap-ai --skill swap-integration` — verify installed | ⬜ |
| P2-002 | Obtain Uniswap Trading API key, add to `.env`, test `POST /v1/quote` with cURL on Base Mainnet | ⬜ |
| P2-003 | Run `npx skills add coinbase/agentic-wallet-skills` — verify installed | ⬜ |
| P2-004 | Obtain CDP credentials, create test agent wallet on Base Mainnet, verify on BaseScan | ⬜ |
| P2-005 | Read and follow `https://raw.githubusercontent.com/DefiLlama/defillama-skills/refs/heads/master/defillama-setup/SKILL.md` | ⬜ |
| P2-006 | Configure DefiLlama MCP in `claude_desktop_config.json` (or project MCP config) | ⬜ |
| P2-007 | Verify DefiLlama MCP responds: query "TVL of Uniswap on Base" and confirm result | ⬜ |
| P2-008 | Privy: create app at `dashboard.privy.io`, restrict supported chains to Base Mainnet (8453) only | ⬜ |
| P2-009 | Install `@privy-io/react-auth` (pin exact version), add `VITE_PRIVY_APP_ID` + `PRIVY_APP_SECRET` to `.env` | ⬜ |
| P2-010 | Configure Privy per accepted decisions: `loginMethods: ['email', 'google', 'apple', 'passkey', 'wallet']` (D-005); `embeddedWallets.createOnLogin: 'users-without-wallets'` (D-006); WalletConnect enabled with project ID (D-007) | ⬜ |
| P2-011 | Wrap app root in `PrivyProvider` with configured `loginMethods`, `embeddedWallets`, `defaultChain: base`, `supportedChains: [base]` | ⬜ |
| P2-012 | Build login UI: `usePrivy().login()` trigger, loading state on `ready`, logged-in state via `authenticated` | ⬜ |
| P2-013 | Wire Privy → wagmi/viem bridge: use `useWallets()` to get active wallet's EIP-1193 provider for viem clients | ⬜ |
| P2-014 | Server-side: verify Privy access tokens on protected API routes using `@privy-io/server-auth` | ⬜ |
| P2-015 | HTTPS enforcement: dev and prod must serve over HTTPS (Privy's Web Crypto API fails silently on HTTP) | ⬜ |
| P2-016 | Integration smoke test: Privy login → embedded wallet provisioned → quote fetched → DefiLlama query returns. All four green. | ⬜ |

### P2-011 Details: PrivyProvider Configuration (accepted decisions baked in)
```tsx
import { PrivyProvider } from "@privy-io/react-auth";
import { base } from "viem/chains";

<PrivyProvider
  appId={import.meta.env.VITE_PRIVY_APP_ID}
  config={{
    appearance: { theme: "dark", accentColor: /* from design tokens PD-002 */ },
    loginMethods: ["email", "google", "apple", "passkey", "wallet"],  // D-005
    embeddedWallets: {
      createOnLogin: "users-without-wallets",  // D-006
      requireUserPasswordOnCreate: false,
    },
    walletConnectCloudProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,  // D-007
    defaultChain: base,
    supportedChains: [base],  // Base Mainnet ONLY — reject any other chain
  }}
>
  {children}
</PrivyProvider>
```

### P2-013 Details: Privy → viem Bridge
```tsx
import { useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";

const { wallets } = useWallets();
const activeWallet = wallets.find(w => w.walletClientType === "privy")
                  ?? wallets[0];
const provider = await activeWallet.getEthereumProvider();
const walletClient = createWalletClient({
  chain: base,
  transport: custom(provider),
});
// walletClient is now usable with Uniswap Trading API swap calldata
```

### P2-015 Details: HTTPS Requirement
Privy's key sharding uses the Web Crypto API, which only works in secure contexts. Plain HTTP (other than `localhost`) fails silently with cryptic errors. Dev setup must use `vite --https` or a local cert; staging/prod require valid TLS.

---

## 💱 PHASE 3: Swap (Core)

> All swaps route through the Uniswap Trading API. No direct PoolManager calls for standard swaps.

| ID | Task | Status |
|----|------|--------|
| P3-001 | Build swap UI: token-in selector, amount input, token-out selector, quote display, confirm button | ⬜ |
| P3-002 | Wire `POST /v1/quote` to Trading API with Base Mainnet chainId (8453) | ⬜ |
| P3-003 | Display quote details: expected output, price impact, gas estimate, route summary | ⬜ |
| P3-004 | Implement Permit2 approval flow (EIP-712 signature, no separate approval tx) | ⬜ |
| P3-005 | Execute swap: user signs Permit2 + submits calldata via viem → wait for receipt | ⬜ |
| P3-006 | On success: show BaseScan link, insert row into `portfolio_transactions` | ⬜ |
| P3-007 | Error handling: insufficient balance, quote expired, spending cap exceeded, kill-switch, user reject | ⬜ |
| P3-008 | E2E test: 10 token-pair combinations (ETH↔USDC, ETH↔cbBTC, ETH↔EURC, ETH↔LINK, USDC↔cbBTC, USDC↔EURC, USDC↔LINK, cbBTC↔EURC, cbBTC↔LINK, EURC↔LINK) | ⬜ |

### P3-004 Details: Permit2 Flow
Use Uniswap Trading API response — it returns permit data when needed. Sign with `signTypedData`, pass signature back on `/v1/swap` call. Single user interaction for approval + swap.

---

## 💧 PHASE 4: Liquidity (Add & Remove)

> LP operations via Trading API where supported; fall back to `@uniswap/v4-sdk` + PositionManager for hooked pools.

| ID | Task | Status |
|----|------|--------|
| P4-001 | Liquidity landing page: list of pools with TVL, volume 24h, fees 24h (from DefiLlama) | ⬜ |
| P4-002 | Pool detail page: OHLC chart (lightweight-charts) with 1D/7D/30D via CoinGecko | ⬜ |
| P4-003 | Pool creation flow: select token0, token1, fee tier, tick spacing, optional hook | ⬜ |
| P4-004 | Add Liquidity modal: amounts, price range (concentrated), slippage | ⬜ |
| P4-005 | Execute add liquidity → BaseScan link → insert `positions` + `portfolio_transactions` rows | ⬜ |
| P4-006 | Remove Liquidity button on pool detail (enabled only if user has position) | ⬜ |
| P4-007 | Remove Liquidity modal: percentage slider (25/50/75/100), preview amounts | ⬜ |
| P4-008 | Execute remove → update position status (`closed` if 100%) → BaseScan link | ⬜ |
| P4-009 | Position tracking: use PositionManager events + subgraph for discovery (per v4-sdk guide) | ⬜ |
| P4-010 | E2E test: create pool → add LP → remove 50% → remove 100% → verify all on BaseScan | ⬜ |

---

## 🪝 PHASE 5: Hook Integration (4 Hooks)

> Mantua deploys all four hooks to Base Mainnet. Stable Protection is already deployed; DynamicFee, RWAGate, and ALO must be deployed (or redeployed for mainnet) using Foundry. Each hook is paired with an AI-assisted security analysis pass before being wired into pool creation.

### Hook Address Registry

| Hook | Network | Address | Status |
|------|---------|---------|--------|
| Stable Protection | Base Mainnet | `0x8739547f74E097020af6d6e306eDB6bD64C3A0C0` | ✅ Deployed |
| DynamicFee | Base Sepolia | `0x25F98678a92Af6aCC54cE3cE687762aCA316C0C0` | 🔧 Redeploy to mainnet |
| RWAGate | Base Sepolia | `0xD97eA18385159A56c41D5a85d0Ff7531697dCA80` | 🔧 Redeploy to mainnet |
| ALO | Base Sepolia | `0xb9e29f39bbf01c9d0ff6f1c72859f0ef550fd0c8` | 🔧 Redeploy to mainnet |

### Stable Protection Hook (Already Deployed)

| ID | Task | Status |
|----|------|--------|
| P5-001 | Verify Stable Protection deployment on Base Mainnet (`0x8739...A0C0`) via BaseScan | ⬜ |
| P5-002 | Valid pair gating: USDC/EURC, USDC/USDT (add USDT if supported), EURC/USDT | ⬜ |
| P5-003 | UI: 5-zone peg status indicator (🟢 HEALTHY / 🟡 MINOR / 🟠 MODERATE / 🔴 SEVERE / ⛔ CRITICAL) | ⬜ |
| P5-004 | Warn user when zone ≥ MODERATE; block swap when zone = CRITICAL with clear message | ⬜ |
| P5-005 | Create pool with Stable Protection: USDC/EURC pool via `@uniswap/v4-sdk` + PositionManager | ⬜ |
| P5-006 | E2E: swap within pool with peg healthy; verify fee applied per zone | ⬜ |

### DynamicFee Hook

| ID | Task | Status |
|----|------|--------|
| P5-007 | Deploy DynamicFee to Base Mainnet via Foundry; verify on BaseScan | ⬜ |
| P5-008 | Wire Chainlink price feed (LINK/USD or per-pair feed) for volatility measurement on Base Mainnet | ⬜ |
| P5-009 | UI: display current dynamic fee in swap modal before confirmation | ⬜ |
| P5-010 | E2E: swap on a DynamicFee-hooked pool; verify fee adjusts under volatility scenarios | ⬜ |

### RWAGate Hook

| ID | Task | Status |
|----|------|--------|
| P5-011 | Deploy RWAGate to Base Mainnet via Foundry; define per-pool compliance gating mechanism (KYC list / institutional allowlist) | ⬜ |
| P5-012 | UI: RWA pool access gated — show "Verification required" state for non-compliant wallets | ⬜ |
| P5-013 | E2E: attempt RWA pool interaction with non-compliant wallet (rejected) and compliant wallet (accepted) | ⬜ |

### ALO (Async Limit Order) Hook

| ID | Task | Status |
|----|------|--------|
| P5-014 | Deploy ALO to Base Mainnet via Foundry; verify on BaseScan | ⬜ |
| P5-015 | UI: limit order entry form (price, amount, expiry) + pending orders list | ⬜ |
| P5-016 | E2E: place limit order, verify async execution at target price, verify expiry handling | ⬜ |

### AI-Assisted Security Analysis (replaces external audit per project decision)

> Methodology: Trail of Bits Claude Code skills via `https://github.com/DelleonMcglone/AI-assisted-security-analysis`. Install plugin marketplace and run targeted analyses against each hook's source before wiring into pool creation flow. Findings logged in `docs/security/` with status (fix / accept / mitigate). All analyses must be re-run after any contract change.

| ID | Task | Status |
|----|------|--------|
| P5-017 | Install Trail of Bits skills marketplace: `/plugin marketplace add DelleonMcglone/AI-assisted-security-analysis` | ⬜ |
| P5-018 | Run `audit-context-building` against each of the 4 hook contracts; capture architectural notes in `docs/security/` | ⬜ |
| P5-019 | Run `entry-point-analyzer` to enumerate state-changing entry points for each hook | ⬜ |
| P5-020 | Run `building-secure-contracts` vulnerability scanners on all 4 hooks | ⬜ |
| P5-021 | Run `sharp-edges` (footgun detection) and `insecure-defaults` plugins on all hook configs | ⬜ |
| P5-022 | Run `static-analysis` (CodeQL + Semgrep) on hook contracts; address all HIGH severity findings | ⬜ |
| P5-023 | Run `spec-to-code-compliance` for Stable Protection (peg zones), DynamicFee (volatility math), RWAGate (gating logic), ALO (order matching) — verify each implementation matches its written spec | ⬜ |
| P5-024 | Run `property-based-testing` plugin to generate fuzz harnesses for hook invariants (e.g. "fee never exceeds MAX_FEE_BPS", "RWAGate never lets non-compliant addresses transact") | ⬜ |
| P5-025 | Document all findings in `docs/security/findings.md` with: severity, status (fix/accept/mitigate), and link to fix commit if fixed | ⬜ |
| P5-026 | Re-run all analyses after fixes are merged; produce final `docs/security/sign-off.md` listing residual accepted risks | ⬜ |

### Security Phase Rules
1. **Hooks cannot be wired into pool creation UI until P5-026 is signed off** — no pool creation tasks (P5-005, plus DynamicFee/RWAGate/ALO equivalents) ship before security sign-off.
2. **AI-assisted analysis is not equivalent to a paid third-party audit.** Findings depend on prompt quality and tool coverage. The `docs/security/sign-off.md` file must explicitly acknowledge this limitation.
3. **Any contract change post-sign-off triggers a re-run** of P5-017 through P5-026. No exceptions.
4. **HIGH severity findings block ship.** MEDIUM findings require written acceptance with rationale. LOW findings can be tracked as backlog.

---

## 💰 PHASE F: LP & Mantua Fee

> Mantua v2 is revenue-generating. Fees have two components: (1) the Uniswap v4 LP fee tier selected at pool creation, which goes to LPs and the Uniswap protocol, and (2) a Mantua service fee layered on top, routed via the Uniswap Trading API's portion fee parameters.

### LP Fee Tier (pool creation)

| ID | Task | Status |
|----|------|--------|
| PF-001 | Pool creation UI exposes fee tier selector: 0.01%, 0.05%, 0.30%, 1.00% (v4 standard tiers) | ⬜ |
| PF-002 | Default fee tier per pair type: 0.01% for stablecoin pairs, 0.05% for ETH/stable, 0.30% for volatile, 1.00% for exotic | ⬜ |
| PF-003 | Display selected fee tier in Liquidity page pool list and pool detail | ⬜ |
| PF-004 | Enforce valid tick spacing for each fee tier (v4 requires matching `tickSpacing`) | ⬜ |

### Mantua Service Fee (on swaps)

| ID | Task | Status |
|----|------|--------|
| PF-005 | Generate or designate EOA fee recipient address; secure private key in hardware wallet; document address in `docs/architecture.md` | ⬜ |
| PF-006 | Store fee config in `fee_config` table: `rate_bps`, `recipient`, `effective_from`, `effective_to` | ⬜ |
| PF-007 | Integrate Trading API `portionBips` + `portionRecipient` fields into quote + swap calls (default `MANTUA_FEE_BPS=10`) | ⬜ |
| PF-008 | UI: display fee breakdown in swap confirmation ("Uniswap LP fee: X bps, Mantua fee: Y bps, You pay: Z") | ⬜ |
| PF-009 | Admin endpoint to update fee rate (signed by fee-admin key, logged to audit table); enforce `rate_bps ≤ 25` server-side | ⬜ |
| PF-010 | Track accumulated fee revenue (read EOA balance) — surface threshold alerts at $1k, $5k, $10k to drive multisig migration timing | ⬜ |

### PF-007 Details: Trading API Fee Integration
Uniswap Trading API supports the `portionBips` and `portionRecipient` parameters on `/v1/quote` and `/v1/swap`. The portion fee is deducted from the user's output token and sent to the recipient atomically. Reference: `https://docs.uniswap.org/api/trading/overview`

```typescript
const quote = await fetch('https://trade-api.gateway.uniswap.org/v1/quote', {
  method: 'POST',
  headers: { 'x-api-key': process.env.UNISWAP_TRADING_API_KEY },
  body: JSON.stringify({
    type: 'EXACT_INPUT',
    tokenInChainId: 8453,
    tokenOutChainId: 8453,
    tokenIn,
    tokenOut,
    amount,
    swapper: userAddress,
    portionBips: MANTUA_FEE_BPS,           // 10 = 0.10% default
    portionRecipient: MANTUA_FEE_RECIPIENT, // EOA at launch (see Risk 1)
  }),
});
```

### Fee Safety Rules
1. Fee rate is capped in code — a misconfigured admin call cannot set rate above `MAX_FEE_BPS = 25` (0.25%). This is a hard constant. Lifting requires code change + redeploy.
2. Fee recipient cannot be changed by the agent, ever — only by signed admin action with audit log entry.
3. Fee collection can be disabled by the kill-switch (P1-006): when `MANTUA_KILL_SWITCH=1`, fee is set to 0 bps but swaps still work. Users are never blocked from transacting.
4. EOA recipient hygiene (per Risk 1): hardware wallet for the private key, no exposure to dev environments, written backup of seed phrase stored separately from any digital location, migration to multisig planned per the mitigation in the Risk Acknowledgments section.

---

## 🤖 PHASE 6: Agent (Chat + Autonomous)

> Agent uses `coinbase/agentic-wallet-skills`. Architectural question: does the user's Privy embedded wallet double as the agent wallet, or is the CDP wallet separate?

| ID | Task | Status |
|----|------|--------|
| P6-000 | Architecture confirmation (D-008 ACCEPTED): user's Privy embedded wallet stays the user's primary; agent uses a SEPARATE CDP wallet that the user funds explicitly with a budget. Agent never gets signing rights over the Privy wallet. | ⬜ |
| P6-001 | Agent mode selection screen: Chat vs Autonomous | ⬜ |
| P6-002 | Chat mode: 6 action cards UI (Create Wallet, Send, Swap, Liquidity, Query, Portfolio) | ⬜ |
| P6-003 | Action: Create & Manage Agent Wallet — provision a separate CDP wallet on Base Mainnet via `agentic-wallet-skills`; add explicit "Fund agent" UI for user to deposit a budget into the agent wallet | ⬜ |
| P6-004 | Action: Send Tokens (ETH, cbBTC, USDC, EURC, LINK) with BaseScan confirmation | ⬜ |
| P6-005 | Action: Swap Tokens — reuse `src/lib/swap.ts` module from Phase 3 | ⬜ |
| P6-006 | Action: Add/Remove Liquidity — reuse `src/lib/liquidity.ts` module from Phase 4 | ⬜ |
| P6-007 | Action: Query On-Chain Data — route to DefiLlama MCP | ⬜ |
| P6-008 | Action: Portfolio Summary — show agent wallet balances + tx history | ⬜ |
| P6-009 | Autonomous mode: natural-language instruction input | ⬜ |
| P6-010 | NLP parser: swap, send, add/remove liquidity, query, wallet ops | ⬜ |
| P6-011 | Agent-level spending cap (independent of user cap, set per agent wallet) | ⬜ |
| P6-012 | E2E: all 6 actions in Chat mode + 5 instruction types in Autonomous mode | ⬜ |

### Agent Safety Notes
- Agent wallet has its own spending cap separate from user wallet (P1-001)
- All agent transactions logged in audit log (P1-008)
- Kill-switch (P1-006) halts agent write ops immediately
- Agent cannot change caps, cannot disable safety rails, cannot bypass slippage limits

---

## 📊 PHASE 7: DefiLlama Analytics

> Replaces Dune MCP from v1. Covers protocol TVL, yields, token prices, volume.

| ID | Task | Status |
|----|------|--------|
| P7-001 | DefiLlama MCP connected and responding (verified in P2-007) | ⬜ |
| P7-002 | Chat intent detection: route analytics questions to DefiLlama, trade questions to Uniswap | ⬜ |
| P7-003 | Supported queries: protocol TVL, DEX volume, yield APYs, token price, historical charts | ⬜ |
| P7-004 | Result rendering: tables for tabular data, lightweight-charts for time series | ⬜ |
| P7-005 | Cache DefiLlama responses (60s TTL) to respect rate limits | ⬜ |
| P7-006 | E2E: 10 representative analytics queries return valid, formatted results | ⬜ |

### Example Supported Queries
- "What's the TVL of Uniswap on Base?"
- "Top 5 yield pools on Base right now"
- "DEX volume on Base last 7 days"
- "cbBTC price over the last 30 days"
- "Which stablecoin has the highest APY on Base?"

---

## 💼 PHASE 8: Portfolio Page

| ID | Task | Status |
|----|------|--------|
| P8-001 | Portfolio landing: layout per `Mantua Prototype.html` portfolio screen (do not replicate v1 3-column Hyperliquid layout) | ⬜ |
| P8-002 | USD valuation via DefiLlama or CoinGecko (mainnet prices — NOT hardcoded) | ⬜ |
| P8-003 | Tab: Balances (ETH, cbBTC, USDC, EURC, LINK) with USD value and swap shortcut | ⬜ |
| P8-004 | Tab: LP Positions with hook badges (Stable Protection, DynamicFee, etc.) | ⬜ |
| P8-005 | Tab: Swap History, Pool History, Deposits — all with BaseScan links | ⬜ |
| P8-006 | "Hide Small Balances" toggle (< $1 USD equivalent) | ⬜ |
| P8-007 | Agent Portfolio view: switcher between user wallet and agent wallet | ⬜ |

---

## 🗣️ PHASE N: Natural Language Command Bar

> Unified LLM-powered command bar that appears on Swap, Liquidity, and Agent pages. Users type natural-language intents; the LLM parses them into structured actions; the app confirms before executing.
>
> **Example inputs:**
> - "Add liquidity to a USDC/EURC pool with stable protection"
> - "Swap 0.05 ETH for USDC"
> - "Create a new ETH/LINK pool with 0.30% fee tier"
> - "Remove 50% of my liquidity from the cbBTC/USDC pool"
> - "What's the TVL on Uniswap Base?"
> - "Send 10 USDC to vitalik.eth"

### Parser & Infrastructure

| ID | Task | Status |
|----|------|--------|
| PN-001 | Build LLM provider abstraction (`parseIntent` interface): primary calls Anthropic Claude (Sonnet 4.6 or successor), fallback to OpenAI GPT (4.1 / 5) on availability error. Provider switch is a one-line config change. | ⬜ |
| PN-002 | Define structured intent schema: `{ action, params, confidence }` with Zod validation | ⬜ |
| PN-003 | Implement parser: `parseIntent(userText, context) → Intent` using function calling / structured output | ⬜ |
| PN-004 | Implement confidence routing: ≥0.85 → present preview + execute; 0.65–0.85 → clarification question; <0.65 → reject with rephrase request. Track false-clarify and false-execute rates in the audit log for tuning during beta (PN-011). | ⬜ |
| PN-005 | Supported intents: swap, add_liquidity, remove_liquidity, create_pool, send_tokens, query_analytics, portfolio_summary | ⬜ |

### Command Bar UI

| ID | Task | Status |
|----|------|--------|
| PN-006 | Build `<CommandBar />` component per design prototype — appears on Swap, Liquidity, Agent pages | ⬜ |
| PN-007 | Context awareness: parser receives current page context (e.g. "user is on Liquidity page") to bias intent disambiguation | ⬜ |
| PN-008 | Preview card: after parsing, show the parsed intent as a structured preview BEFORE the confirmation modal (user sees what the LLM understood) | ⬜ |
| PN-009 | Clarification loop: if confidence < threshold OR required param missing, LLM asks a follow-up question instead of executing | ⬜ |

### Safety

| ID | Task | Status |
|----|------|--------|
| PN-010 | Safety rail: confirmation modal (P1-005) is mandatory for every parsed intent that triggers a tx — LLM output never executes directly | ⬜ |
| PN-011 | E2E test: 25 prompt variations per intent type (swap, LP, create pool, send, query) — verify correct parsing and param extraction | ⬜ |

### PN-002 Details: Intent Schema
```typescript
type Intent =
  | { action: 'swap'; tokenIn: TokenSymbol; tokenOut: TokenSymbol; amountIn: string; confidence: number }
  | { action: 'add_liquidity'; token0: TokenSymbol; token1: TokenSymbol; amount0?: string; amount1?: string; feeTier?: number; hook?: HookType; confidence: number }
  | { action: 'remove_liquidity'; poolId: string; percentage: number; confidence: number }
  | { action: 'create_pool'; token0: TokenSymbol; token1: TokenSymbol; feeTier: number; hook?: HookType; confidence: number }
  | { action: 'send_tokens'; token: TokenSymbol; amount: string; recipient: string; confidence: number }
  | { action: 'query_analytics'; question: string; confidence: number }
  | { action: 'portfolio_summary'; confidence: number }
  | { action: 'clarification_needed'; message: string; suggestedIntent?: Partial<Intent> };
```

### PN-010 Details: LLM Output Never Auto-Executes
This is a CRITICAL safety rule. The LLM parses; the user confirms. There is no path from LLM output to on-chain transaction that bypasses the confirmation modal. A misparsed "swap 10 USDC" becoming "swap 10 ETH" must be catchable at the preview stage. Never trust the LLM alone for financial execution.

### Example Prompt → Intent
```
Input:  "Add liquidity to a USDC/EURC pool with stable protection"
Output: {
  action: 'add_liquidity',
  token0: 'USDC',
  token1: 'EURC',
  hook: 'stable',
  amount0: undefined,  // prompt follow-up: "How much USDC and EURC would you like to add?"
  amount1: undefined,
  feeTier: 0.01,        // inferred: stablecoin pair → default 0.01%
  confidence: 0.92
}
```

---

## ✅ PHASE 9: E2E Testing & Launch

| ID | Task | Status |
|----|------|--------|
| P9-001 | Full E2E test suite in Playwright — all flows Phase 3–8 | ⬜ |
| P9-002 | Mainnet fork test environment (Anvil) for CI | ⬜ |
| P9-003 | Confirm AI-assisted security analysis sign-off complete (P5-026); residual accepted risks documented | ⬜ |
| P9-004 | Provision hosting per D-004: Vercel (frontend) + Railway or Fly.io (backend) + Neon (Postgres) | ⬜ |
| P9-005 | Configure CI/CD: GitHub Actions → Vercel + Railway/Fly deploy; staging branch auto-deploys | ⬜ |
| P9-006 | Production build: frontend + backend + DB migrations | ⬜ |
| P9-007 | Deploy to staging, dogfood internally with team wallets for at least 2 weeks | ⬜ |
| P9-008 | Staging E2E: 10 real mainnet transactions across swap, LP, agent, all 4 hooks | ⬜ |
| P9-009 | Terms of Service + Privacy Policy drafted and reviewed | ⬜ |
| P9-010 | Incident runbook: kill-switch activation, rollback, user comms | ⬜ |
| P9-011 | Soft launch: limited organic marketing, monitor for issues with low volume | ⬜ |
| P9-012 | Public launch announcement | ⬜ |

---

## ⚠️ Critical Implementation Rules

1. **Mainnet only** — no Sepolia / Unichain Sepolia / Anvil in production code paths
2. **Chain ID 8453 is fixed** — read from `useChainId()` but reject anything else
3. **NEVER hardcode token prices** — Dune's hardcoded testnet prices (ETH=$2000 etc.) were a v1 expedient; v2 pulls live prices
4. **NEVER duplicate swap/liquidity logic** — single shared module, used by UI and agent
5. **ALWAYS confirm transactions on-chain** — wait for receipt before UI "success"
6. **ALWAYS store transactions in DB** before showing success state
7. **ALWAYS show BaseScan link** for every transaction
8. **File length max 150 lines** — split into modules
9. **No TODOs** — every shipped feature fully implemented
10. **No `any` types** — TypeScript strict mode enforced
11. **No hardcoded secrets** — all via env vars, `.env` gitignored
12. **Mainnet safety rails (Phase 1) must pass before Phase 3+ ships**

---

## ✅ Definition of Done (v2)

### Staging gate (internal dogfood)
- [ ] Phase 0–4 complete (bootstrap, safety, integrations, swap, LP)
- [ ] Phase 5 complete for Stable Protection (other hooks gated on D-002)
- [ ] Phase 6 complete (agent Chat + Autonomous)
- [ ] Phase 7 complete (DefiLlama)
- [ ] Phase 8 complete (Portfolio)
- [ ] Phase 9 items 001–008 complete
- [ ] Kill-switch tested in staging
- [ ] Team has dogfooded for ≥ 2 weeks with zero critical incidents

### Public launch gate
- [ ] All above +
- [ ] AI-assisted security analysis sign-off complete (`docs/security/sign-off.md`); HIGH severity findings all resolved
- [ ] Terms of Service + Privacy Policy live
- [ ] Incident runbook rehearsed, on-call rotation established
- [ ] EOA fee recipient configured with hardware wallet, seed phrase backed up offline (Risk 1 mitigation tracked)
- [ ] Public documentation published

---

## 📊 Task Count Summary

| Phase | Tasks |
|-------|-------|
| Phase 0: Project Bootstrap | 8 |
| Phase D: Design System & UI Shell | 8 |
| Phase 1: Mainnet Safety | 8 |
| Phase 2: Skill, MCP & Wallet Provider Integration | 16 |
| Phase 3: Swap (Core) | 8 |
| Phase 4: Liquidity | 10 |
| Phase 5: Hook Integration + AI Security Analysis | 26 |
| Phase F: LP & Mantua Fee | 10 |
| Phase 6: Agent | 13 |
| Phase 7: DefiLlama Analytics | 6 |
| Phase 8: Portfolio | 7 |
| Phase N: Natural Language Command Bar | 11 |
| Phase 9: E2E & Launch | 12 |
| **Grand Total** | **143** |

---

## 🔗 Reference Links

| Resource | URL |
|----------|-----|
| Base Mainnet explorer | https://basescan.org/ |
| Privy dashboard | https://dashboard.privy.io |
| Privy React docs | https://docs.privy.io/basics/react/quickstart |
| Uniswap Trading API | https://docs.uniswap.org/api/trading/overview |
| Uniswap AI skill | `npx skills add uniswap/uniswap-ai --skill swap-integration` |
| Coinbase agentic-wallet | `npx skills add coinbase/agentic-wallet-skills` |
| DefiLlama setup | https://raw.githubusercontent.com/DefiLlama/defillama-skills/refs/heads/master/defillama-setup/SKILL.md |
| CDP SDK docs | https://docs.cdp.coinbase.com/cdp-sdk/docs/welcome |
| CoinGecko API | https://api.coingecko.com/api/v3 |
| Foundry book | https://book.getfoundry.sh/ |

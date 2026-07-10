# Mantua.AI

**Mantua.AI is an agent-driven liquidity protocol for stablecoins** — it lets users and
institutions manage stablecoin positions, deploy liquidity, and run automated rebalancing
strategies through natural language. It combines a custom suite of **Uniswap v4 hooks**,
autonomous **AI agents** running **Circle Developer-Controlled Wallets**, and real-time on-chain
execution to turn user intent into automated liquidity actions — a programmable liquidity layer
optimized for stablecoins, RWAs, and yield-bearing dollar assets.

From a single natural-language prompt you can:

- **Analyze & research** — pool health, peg status, token prices, and hook explanations (free
  data, with optional pay-per-call x402 premium sources).
- **Swap** — USDC, EURC, and cirBTC across the hook pools.
- **Add / remove liquidity** — to hook-protected and no-hook pools via the Uniswap v4
  PositionManager + Permit2.
- **Run an autonomous agent** — a Circle-managed wallet that swaps, manages liquidity, and
  auto-rebalances out of de-pegging stablecoins on a daily schedule.
- **Bridge & manage treasury** — move USDC cross-chain (Circle CCTP) and hold a unified,
  multi-chain USDC balance (Circle Gateway).

## The problem and who it's for

Managing stablecoin liquidity today is operationally manual, interface-fragmented,
strategy-dependent, and exposed to peg risk across pools, venues, and market conditions.
Mantua.AI lets **liquidity providers, stablecoin issuers, fintech platforms, and RWA protocols**
deploy peg-aware liquidity, automated rebalancing, and yield-seeking routing directly from
natural-language instructions, executed on-chain via agent-managed Uniswap v4 hook strategies.

## Why it's better

Stablecoin pools today are passive. Mantua makes them **state-aware, fee-adaptive,
oracle-enforced, and agent-managed** by embedding these behaviors directly into AMM execution
logic through Uniswap v4 hooks. By letting AI agents coordinate liquidity in response to
real-time market conditions, Mantua transforms stablecoin liquidity from static capital into an
automated financial control system for compliant routing, treasury management, and RWA
settlement.

---

## App capabilities

- **Universal command bar.** One input routes every command by intent — a card only *starts* a
  mode, it never locks it. Hookless actions and agent commands go to the Circle Agent; naming a
  hook (Stable Protection / Dynamic Fee) opens the manual Uniswap-v4 panel; research questions
  open Analyze. 
- **Peg-aware Uniswap v4 hooks.** Two custom hooks — Stable Protection and Dynamic Fee — embed
  fee logic and circuit breakers directly into pool execution. Stable Protection is
  **FX-aware**: its circuit breaker anchors to the live EUR/USD rate (Pyth) instead of assuming
  1:1, so USDC/EURC trades at the true ~1.14 rate (see [Liquidity Hooks](#liquidity-hooks)).
- **Swap · Liquidity Pools.** Manual v4 swaps with live quotes and hook selection; create
  pools and add/remove liquidity (market-priced initialization); pool detail pages with real
  pair exchange-rate charts.
- **Cross-chain USDC bridging.** Outbound from Arc to all 12 CCTP-V2 testnets — Base, Ethereum,
  Arbitrum, Unichain, Avalanche Fuji, OP, Polygon Amoy, Linea, Sonic, World Chain, Sei,
  HyperEVM — via Circle CCTP (Bridge Kit).
- **Unified balance / treasury.** A single multi-chain USDC balance via Circle Gateway
  (Unified Balance Kit) — view, deposit, and **spend**: settle USDC out of the unified balance
  to any Gateway testnet (burn on Arc, mint on the destination), with Arc as the settlement
  hub.
- **Analyze & research.** Inline conversational research: deterministic cited data cards for
  known topics + AI-streamed answers for free-form questions.
- **Portfolio & earnings.** User + agent portfolios, LP positions, and fee earnings with an
  estimated LP/hook split grouped by hook.

## Agent capabilities (your Circle Agent)

An autonomous financial analyst — trader and liquidity provider — running a tool-using Claude
loop over a server-custodied Circle wallet on Arc (sponsored gas, daily USD spending cap):

- **Wallet** — auto-provisioned; view/manage, set the daily cap, and fund it (Circle's
  programmatic testnet faucet, with manual faucet fallback).
- **Trade & move** — swap (signal-guarded: peg deviation + price impact), send, and bridge USDC
  to any CCTP chain (funds land at *your* wallet on the destination).
- **Treasury (Circle Gateway)** — manages its own unified USDC balance: consolidate on Arc,
  read the cross-chain breakdown, and settle USDC out to any Gateway testnet on demand (spends
  to third parties count against the daily cap).
- **FX best execution (StableFX)** — for USDC↔EURC the agent compares Circle's **StableFX**
  RFQ rate, the live on-chain pool rate, and the Pyth interbank EUR/USD reference, then
  recommends the better venue (executing on-chain when the pool wins), citing the spread vs
  interbank.
- **Liquidity** — create no-hook pools at the live market price, add/remove liquidity, list
  positions.
- **On-chain analysis (Arcscan).** Inspect any Arc address (balance, activity, whale signals:
  accumulating/selling, stables↔tokens rotation), any token (holders, top-10 concentration,
  safety red flags), and any transaction (decoded token movements).
- **Analyst workflow.** "Give me my daily briefing" → market pulse → peg check → portfolio
  review → on-chain highlights, figures first. Never blindly copies a wallet — verifies
  hypotheses against live data.
- **Analyst advisor.** If the agent can't afford a trade (balance or cap), it reads *your*
  wallet and — if you hold enough — delivers its analysis with a concrete "execute this
  yourself" recommendation.
- **Autonomous de-peg rebalancing.** Opt-in: auto-exits a stablecoin that drifts off peg into
  the on-peg reference — signal-gated, capped, audited — on a daily cron.
- **x402 agent marketplace.** Access to Circle's full paid-services catalog
  ([agents.circle.com/services](https://agents.circle.com/services)) — web search, news,
  weather, sports, prediction markets, social lookups, papers, SMS/communication APIs — paid
  per-call in USDC (pre-capped); the agent searches the marketplace before declining a request
  (local, opt-in — [setup](docs/x402-setup.md)).

---

## Built with

### Uniswap v4

- **Custom hooks** — two production hooks, each deployed at a mined CREATE2 address (Stable
  Protection, Dynamic Fee). Source repos linked under [Architecture](#architecture).
- **v4 periphery, per hook** — PoolManager, PositionManager, StateView, V4Quoter, and
  PoolSwapTest. The app routes each pool's create / liquidity / swap / read to its hook's own
  stack (no-hook pools fall back to the Stable Protection stack).
- **Permit2** (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) for gas-efficient LP approvals.
- Quotes via **V4Quoter**; all addresses live in
  [`server/src/lib/v4-contracts.ts`](server/src/lib/v4-contracts.ts).

### Circle

- **Developer-Controlled Wallets** (`@circle-fin/developer-controlled-wallets`) — server-managed
  agent wallets (smart-contract accounts) that sign and execute on Arc with **sponsored gas**;
  the user's signing key is never touched by the agent path.
- **CCTP via Bridge Kit** (`@circle-fin/bridge-kit`) — native cross-chain USDC burn-and-mint to
  all 12 CCTP-V2 testnets, used both by the app (user wallet) and server-side by the agent's
  Circle wallet (Circle-Wallets adapter + Forwarding Service).
- **Gateway via Unified Balance Kit** (`@circle-fin/unified-balance-kit` +
  `@circle-fin/adapter-circle-wallets` + `@circle-fin/adapter-viem-v2`) — unified multi-chain
  USDC balance: deposits (agent SCA) and spends to any Gateway testnet, signed by a Gateway
  **delegate** EOA on the SCA's behalf (SCAs can't sign burn intents directly).
- **StableFX** (`POST /v1/exchange/stablefx/quotes`) — Circle's institutional stablecoin FX
  engine on Arc; the agent pulls RFQ reference quotes for USDC↔EURC and compares them against
  on-chain liquidity for best execution.
- **x402 agent marketplace** (Circle CLI) — the full paid-services catalog at
  [agents.circle.com/services](https://agents.circle.com/services), paid per-call in USDC.
- **USDC + EURC** stablecoins, funded for testing via the
  **[Circle Faucet](https://faucet.circle.com)**.

### Arc

- **Arc Testnet** (chain id `5042002`) — Circle's stablecoin-native L1 where **USDC is the gas
  token**. RPC `https://rpc.testnet.arc.network`; explorer [ArcScan](https://testnet.arcscan.app).
- **Arcscan (Blockscout) API** — powers the agent's on-chain analysis tools (address activity,
  token holders, transaction decoding).
- All hook stacks, tokens, and agent wallets are deployed on Arc (addresses
  [below](#deployed-contracts-arc-testnet-5042002)).

### Pyth Network

- **Hermes price feeds** — primary price source behind `getUsdPrice` and the peg signals
  (USDC/USD, EURC/USD, BTC/USD, EUR/USD FX), with DefiLlama as automatic fallback. The EURC peg
  is measured FX-neutrally (EURC/USD ÷ EUR/USD).
- **Peg keeper** — a daily cron pushes the live EUR/USD reference on-chain to the FX-aware
  Stable Protection hook (`setPegReference`), anchoring its circuit breaker to the real rate.

### Application

- **Client** — Vite + React + TypeScript SPA; Privy auth (embedded + external wallets), viem,
  lightweight-charts.
- **Server** — Express + TypeScript API; Anthropic **Claude** (`claude-opus-4-8`) agent loop,
  Drizzle ORM + Postgres (Neon). Deployed on **Vercel** (serverless) with daily crons (agent rebalance + Pyth peg-sync).

---

## Network

Mantua.AI runs on **Arc Testnet** — Circle's stablecoin-native L1, where **USDC is the gas
token**.

| Network     | Chain ID  | RPC                               | Explorer                    |
| ----------- | --------- | --------------------------------- | --------------------------- |
| Arc Testnet | `5042002` | `https://rpc.testnet.arc.network` | https://testnet.arcscan.app |

### Tokens

| Token   | Address                                      | Decimals | Notes                         |
| ------- | -------------------------------------------- | -------- | ----------------------------- |
| USDC    | `0x3600000000000000000000000000000000000000` | 6        | Native gas token (ERC-20) |
| EURC    | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | 6        | Circle EURC                   |
| cirBTC  | `0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF` | 8        | BTC-pegged demo asset         |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | —        | Canonical (all chains)        |

---

## Liquidity Hooks

Mantua ships two Uniswap v4 hooks. Because v4 allows **one hook per pool key**, each hook is a
distinct contract deployed at a mined CREATE2 address, and each lives on its **own** Uniswap v4
stack (PoolManager + PositionManager + StateView + V4Quoter + PoolSwapTest). The app routes every
pool's create / liquidity / swap / read to the stack of that pool's hook.

| Hook                  | Pairs                    | Purpose                                                       |
| --------------------- | ------------------------ | ------------------------------------------------------------- |
| **Stable Protection** | USDC/EURC                | FX-aware peg-zone fees + circuit breaker (EUR/USD-anchored via Pyth) |
| **Dynamic Fee**       | USDC/cirBTC, EURC/cirBTC | Per-swap fee scales with TWAP-derived volatility              |

> Two further hooks — **RWA Gate** (permissioned pools via a ComplianceRegistry) and
> **Async Limit Order** — are built and were previously deployed on testnet, but are
> **deferred to mainnet**, where RWA-grade tokens better match their use cases.

---

## Deployed Contracts (Arc Testnet `5042002`)

All addresses are live on Arc Testnet and verifiable on [ArcScan](https://testnet.arcscan.app).
Each hook has its own full v4 stack.

### Stable Protection — USDC/EURC

| Contract        | Address                                      |
| --------------- | -------------------------------------------- |
| Hook            | `0xd1Deea248850BFc239Cb282b793b076357Cb20c0` |
| PoolManager     | `0x15B5f2c054b9DC788250131FCD1bcfCC34080a59` |
| PositionManager | `0x47AD8c1C78F9b07c81d833d924BbE36388A4ab78` |
| StateView       | `0x73Bb8E68c08C528770880c10223670f7aee13824` |
| V4Quoter        | `0xd57545f0a2C3A721Fc3F1F4f3007b2aA021f4567` |
| PoolSwapTest    | `0xeA44982cB8b71A9BF69bfe3F3f5b43E1790be4d1` |

### Dynamic Fee — USDC/cirBTC, EURC/cirBTC

| Contract        | Address                                      |
| --------------- | -------------------------------------------- |
| Hook            | `0xA1Be807481F532c074380FCcF05be5e2A3ec80C0` |
| PoolManager     | `0x7eA87A5919C119DC95855A0BE227fd3241c998F0` |
| PositionManager | `0xDa1bfA53fA93463fB9Abd349bad381667D29b88d` |
| StateView       | `0x6F4eD6D86e8d770Dc7Ef027011d7cd6c12Db40c9` |
| V4Quoter        | `0x2CF521F13658FE57958D09B40Ee3420D974EE7eC` |
| PoolSwapTest    | `0xAa096011E6604df33762d611cbBdaA0671F19Bdb` |

The canonical source of truth for these addresses is
[`server/src/lib/v4-contracts.ts`](server/src/lib/v4-contracts.ts) (`HOOK_DEPLOYMENTS_ARC`).

---

## Architecture

```
client/   Vite + React + TypeScript SPA (port 5173) — chat UI, swap/LP/agent panels
server/   Express + TypeScript API (port 3001) — calldata builders, quotes, agent + portfolio
deploy/   Foundry deploy scripts for the per-hook Arc v4 periphery + pool setup
```

- **Per-hook routing.** `getV4StackForHook(poolKey.hooks)` resolves the PoolManager + periphery
  for a pool from its hook address, so each pool's operations target its own stack. No-hook pools
  fall back to the Stable Protection ("hero") stack.
- **Wallets.** Users connect via Privy (embedded + external). Agents use **Circle
  Developer-Controlled Wallets** (server-managed smart-contract accounts on Arc) — the user's
  signing key is never touched by the agent path.
- **Hook source repos.** [stableprotection-hook](https://github.com/DelleonMcglone/stableprotection-hook) ·
  [dynamic-fee](https://github.com/DelleonMcglone/dynamic-fee) ·
  [RWAgate](https://github.com/DelleonMcglone/RWAgate) ·
  [limit-orders](https://github.com/DelleonMcglone/limit-orders) (the last two are
  mainnet-deferred)

---

## Local development

```bash
npm install
# server (port 3001) + client (port 5173)
npm run dev
```

Requires Postgres + a `.env` (see `server/.env.example`, `client/.env.example`). Verify with:

```bash
npm run typecheck            # both workspaces
npm test -w @mantua/server   # 63 tests
npm test -w @mantua/client   # 58 tests
```

Optional: the agent can pay per-call for premium data via Circle's x402
marketplace (local-only, off by default) — see [`docs/x402-setup.md`](docs/x402-setup.md).

## Deploying the on-chain stacks

Foundry scripts for re-deploying the per-hook periphery / pool setup live under
[`deploy/`](deploy/) — each with a README and the exact `forge script` commands
(all use `--via-ir --optimizer-runs 200`).

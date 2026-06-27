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

## The problem — and who it's for

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

## Core features

- **Conversational autonomous agent.** A tool-using loop (Anthropic Claude) drives a
  server-custodied Circle wallet: it swaps, sends, adds/removes liquidity, reads the portfolio,
  and answers research questions — grounded in live signals (peg deviation, price impact) with
  in-code safety guardrails and a daily USD spending cap.
- **Peg-aware Uniswap v4 hooks.** Four custom hooks (Stable Protection, Dynamic Fee, RWA Gate,
  Async Limit Order) embed fee logic, circuit breakers, compliance gating, and limit orders
  directly into pool execution (see [Liquidity Hooks](#liquidity-hooks)).
- **Autonomous de-peg rebalancing.** Opt-in agents auto-exit a stablecoin that drifts off peg
  into the on-peg reference — gated by live signals + per-run caps — on a daily cron.
- **Cross-chain USDC bridging.** Outbound USDC transfers from Arc to Base, Ethereum, Arbitrum,
  Unichain (Sepolia) and Avalanche Fuji via Circle CCTP (Bridge Kit).
- **Unified balance / treasury.** A single multi-chain USDC balance (view + deposit) via Circle
  Gateway (Unified Balance Kit).
- **Pay-per-call research (x402).** The agent can pay tiny USDC fees to call premium data APIs
  from Circle's x402 services marketplace when free data isn't enough — local, opt-in
  ([setup](docs/x402-setup.md)).

---

## Built with

### Uniswap v4

- **Custom hooks** — four hooks, each deployed at a mined CREATE2 address (Stable Protection,
  Dynamic Fee, RWA Gate, Async Limit Order). Source repos linked under [Architecture](#architecture).
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
- **CCTP via Bridge Kit** (`@circle-fin/bridge-kit`) — native cross-chain USDC burn-and-mint.
- **Gateway via Unified Balance Kit** (`@circle-fin/unified-balance-kit` +
  `@circle-fin/adapter-circle-wallets`) — unified multi-chain USDC balance and deposits.
- **x402 services marketplace** (Circle CLI) — pay-per-call paid APIs for agent research.
- **USDC + EURC** stablecoins, funded for testing via the
  **[Circle Faucet](https://faucet.circle.com)**.

### Arc

- **Arc Testnet** (chain id `5042002`) — Circle's stablecoin-native L1 where **USDC is the gas
  token**. RPC `https://rpc.testnet.arc.network`; explorer [ArcScan](https://testnet.arcscan.app).
- All hook stacks, tokens, and agent wallets are deployed on Arc (addresses
  [below](#deployed-contracts-arc-testnet-5042002)).

### Application

- **Client** — Vite + React + TypeScript SPA; Privy auth (embedded + external wallets), viem,
  lightweight-charts.
- **Server** — Express + TypeScript API; Anthropic **Claude** (`claude-opus-4-8`) agent loop,
  Drizzle ORM + Postgres (Neon). Deployed on **Vercel** (serverless) with a daily rebalance cron.

---

## Network

Mantua.AI runs on **Arc Testnet** — Circle's stablecoin-native L1, where **USDC is the gas
token**.

| Network     | Chain ID  | RPC                               | Explorer                    |
| ----------- | --------- | --------------------------------- | --------------------------- |
| Arc Testnet | `5042002` | `https://rpc.testnet.arc.network` | https://testnet.arcscan.app |

Get testnet tokens from the **[Circle Faucet](https://faucet.circle.com/)** (USDC + EURC; Arc
USDC also pays for gas).

### Tokens

| Token   | Address                                      | Decimals | Notes                         |
| ------- | -------------------------------------------- | -------- | ----------------------------- |
| USDC    | `0x3600000000000000000000000000000000000000` | 6        | Native gas token (ERC-20 i/f) |
| EURC    | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | 6        | Circle EURC                   |
| cirBTC  | `0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF` | 8        | BTC-pegged demo asset         |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | —        | Canonical (all chains)        |

---

## Liquidity Hooks

Mantua ships four Uniswap v4 hooks. Because v4 allows **one hook per pool key**, each hook is a
distinct contract deployed at a mined CREATE2 address, and each lives on its **own** Uniswap v4
stack (PoolManager + PositionManager + StateView + V4Quoter + PoolSwapTest). The app routes every
pool's create / liquidity / swap / read to the stack of that pool's hook.

| Hook                  | Pairs                    | Purpose                                                       |
| --------------------- | ------------------------ | ------------------------------------------------------------- |
| **Stable Protection** | USDC/EURC                | Peg-zone-aware fees + circuit breaker to defend LPs on depegs |
| **Dynamic Fee**       | USDC/cirBTC, EURC/cirBTC | Per-swap fee scales with TWAP-derived volatility              |
| **RWA Gate**          | USDC/EURC, USDC/cirBTC   | Permissioned pool — only allowlisted addresses may trade      |
| **Async Limit Order** | USDC/cirBTC, EURC/cirBTC | Queue limit orders that fill at a target price                |

---

## Deployed Contracts (Arc Testnet `5042002`)

All addresses are live on Arc Testnet and verifiable on [ArcScan](https://testnet.arcscan.app).
Each hook has its own full v4 stack.

### Stable Protection — USDC/EURC

| Contract        | Address                                      |
| --------------- | -------------------------------------------- |
| Hook            | `0xF131A048875E578A0F89393e858C0442fcD7e0C0` |
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

### RWA Gate — USDC/EURC, USDC/cirBTC

| Contract           | Address                                      |
| ------------------ | -------------------------------------------- |
| Hook               | `0xC5B49e30Fb7FD99FCB608Bd661F28AfcC44FCA80` |
| PoolManager        | `0xBC9C4e3e51E18Ea44c7363391d29ed300db57511` |
| ComplianceRegistry | `0x5E33Ed3D77Ff22B9c6eD689a18a040E7633f9003` |
| PositionManager    | `0xCa059a9a7064EcC446aB34eAe400e1a76D3288C3` |
| StateView          | `0xBecb1cd296675CFC3fC8e63c4838590A4C97196d` |
| V4Quoter           | `0x49ffeA1ECd7760fC55F3598D7A0d89239cfeAea9` |
| PoolSwapTest       | `0xE6D1d7d837099132b9A6c68B1e3B2fdEe5feEF00` |

> RWA Gate is permissioned: the hook calls `ComplianceRegistry.checkCompliance(sender)` on
> swap / add / remove. The PositionManager and routers are allowlisted; the operator allowlists
> end-user addresses via `ComplianceRegistry.addToWhitelist(addr, 0)`.

### Async Limit Order (ALO) — USDC/cirBTC, EURC/cirBTC

| Contract        | Address                                      |
| --------------- | -------------------------------------------- |
| Hook            | `0x18c2c2E657912E21091E364b5daB4f9702c810c8` |
| PoolManager     | `0x95b7d2f0712f997A34c7D1b4CBaE144251CE083b` |
| PositionManager | `0x7866e36b7576DF5167cf76770799096Ba6fcD882` |
| StateView       | `0xbF8dC490E538a7749f9DF6B34Ee740650D325b15` |
| V4Quoter        | `0xA12B21D108Eb0ad982870d90CcB66976274d3b18` |
| PoolSwapTest    | `0xFCf895f7F5737b1D582a0bD4b131f88434a94433` |

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
  [limit-orders](https://github.com/DelleonMcglone/limit-orders)

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

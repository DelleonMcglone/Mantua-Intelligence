# Mantua AI v2 — Contracts (Foundry)

Hooks for Uniswap v4 pools. Target chain at launch is Base Mainnet (8453);
all four hooks currently live on testnets pending mainnet redeployment +
security sign-off (see `docs/security/sign-off.md`).

## Setup

```bash
# Install Foundry (one-time)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install deps (forge-std, OpenZeppelin, Uniswap v4 core/periphery, solmate)
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts --no-git
forge install Uniswap/v4-core --no-git
forge install Uniswap/v4-periphery --no-git
forge install transmissions11/solmate --no-git

# Pull hook submodules (once per clone)
git submodule update --init --recursive
```

## Layout

- `src/` — Mantua-owned hook source (currently empty; vendored hooks live in `hooks/`).
- `hooks/` — git submodules pinned to specific commits of each external hook repo (see "Hooks" below).
- `test/` — Foundry tests, fork tests, fuzz harnesses (Phase 5 P5-024).
- `script/` — deployment + admin scripts. Includes `verify-hooks.ts` (P5-001 deployment verification).
- `lib/` — Foundry-managed dependencies (gitignored).

## Hooks (Phase 5)

Each hook is vendored as a git submodule under `contracts/hooks/`. Run
`npm run verify:hooks` from the repo root to refresh the on-chain
verification report at `docs/security/hook-deployments.md`.

| Hook | Source | Deployment | Address | Permissions |
| ---- | ------ | ---------- | ------- | ----------- |
| Stable Protection | [`stableprotection-hook@1282b89`](https://github.com/DelleonMcglone/stableprotection-hook/commit/1282b899b6f68d27e28d65194dc75661f23476af) | Base Sepolia (84532) | `0xe5e6a9E09Ad1e536788f0c142AD5bc69e8B020C0` | beforeInitialize, beforeSwap, afterSwap |
| DynamicFee | [`dynamic-fee@62710d6`](https://github.com/DelleonMcglone/dynamic-fee/commit/62710d6d9b403557b073a702b5546bc10e75c0c6) | Base Sepolia (84532) | `0x9788B8495ebcEC1C1D1436681B0F56C6fc0140c0` | beforeSwap, afterSwap |
| RWAGate | [`RWAgate@bb41ada`](https://github.com/DelleonMcglone/RWAgate/commit/bb41ada54c9c9fb5a2bea296728321f68cf2dcc1) | Base Sepolia (84532) | `0xbba7cf860b47e16b9b83d8185878ec0fad0d4a80` | beforeAddLiquidity, beforeRemoveLiquidity, beforeSwap |
| AsyncLimitOrder | [`limit-orders@89d905f`](https://github.com/DelleonMcglone/limit-orders/commit/89d905f1d39abbc3795015fc4adfb8140560194b) | Base Sepolia (84532) | `0xb9e29f39bbf01c9d0ff6f1c72859f0ef550fd0c8` | afterInitialize, beforeSwap, afterSwap, beforeSwapReturnsDelta |

**No hook is on Base Mainnet (8453) yet.** Re-deployment to mainnet, after security sign-off, is the launch-gating step.

## Security analysis

All hook source is run through the AI-assisted security analysis suite (Phase 5 P5-017 → P5-026) before mainnet redeployment. Findings logged in `docs/security/findings.md`; sign-off in `docs/security/sign-off.md`. Re-run on every pinned-commit bump.

## Common commands

```bash
forge build               # compile
forge test                # run unit tests
forge fmt                 # format
forge snapshot            # gas snapshots
forge coverage            # coverage report

# Mainnet fork test (from project root)
forge test --fork-url $BASE_RPC_URL
```

See `docs/architecture.md` for how contracts integrate with `client/` and `server/`.

# Mantua AI v2 — Contracts (Foundry)

Hooks for Uniswap v4 pools deployed on Base Mainnet (chain ID 8453).

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
```

## Layout

- `src/` — hook contract sources (Stable Protection, DynamicFee, RWAGate, ALO).
- `test/` — Foundry tests, fork tests, fuzz harnesses (Phase 5 P5-024).
- `script/` — deployment + admin scripts.
- `lib/` — Foundry-managed dependencies (gitignored).

## Hooks (Phase 5)

| Hook | Status | Mainnet address |
| ---- | ------ | --------------- |
| Stable Protection | ✅ Deployed | `0x8739547f74E097020af6d6e306eDB6bD64C3A0C0` |
| DynamicFee | 🔧 Redeploy to mainnet | TBD |
| RWAGate | 🔧 Redeploy to mainnet | TBD |
| ALO | 🔧 Redeploy to mainnet | TBD |

## Security analysis

All hook source code is run through the AI-assisted security analysis suite (Phase 5 P5-017 → P5-026) before being wired into pool creation. Findings logged in `docs/security/findings.md`; sign-off in `docs/security/sign-off.md`. Re-run on every contract change.

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

# Sepolia E2E runbook (P9-008)

How to run the 10+ real Base Sepolia transactions that close out
**P9-008**. The script lives in
[`contracts/script/SepoliaE2E.s.sol`](../contracts/script/SepoliaE2E.s.sol).
It hits three pool configurations (no-hook, Stable Protection,
Dynamic Fee) with the four-stage lifecycle (initialize → add → swap →
remove) for each, against your real Sepolia wallet.

The script never sees the private key in source. It reads it from
the `PRIVATE_KEY` env var at runtime, derives the sender address
locally, logs the address before broadcasting so you can confirm,
and signs every tx in your shell.

## Prerequisites

- Foundry installed (`forge --version` should print)
- Your Sepolia wallet has:
  - At least 0.05 ETH for gas (each tx is ~150k–300k gas)
  - At least 0.5 USDC and 0.5 EURC for the deposits (the script uses
    ~0.09 of each token total across all configs, but you want
    headroom for slippage / gas)
- Optional: a `BASE_SEPOLIA_RPC_URL` for a non-rate-limited RPC
  (Alchemy / QuickNode / Infura free tier). The public endpoint
  works but flakes under fanout.

## What the script does

| Step | Pool config | Action |
|------|-------------|--------|
| 1 | — | Approve USDC + EURC to PoolSwapTest + PoolModifyLiquidityTest (4 txs, idempotent — skipped on re-run) |
| 2 | no-hook USDC/EURC 0.01% | Initialize (skipped if exists) |
| 3 | no-hook USDC/EURC 0.01% | Add tight-range liquidity (~0.03 each token) |
| 4 | no-hook USDC/EURC 0.01% | Swap 0.01 USDC → EURC |
| 5 | no-hook USDC/EURC 0.01% | Remove half the just-added liquidity |
| 6 | Dynamic Fee USDC/EURC | Initialize |
| 7 | Dynamic Fee USDC/EURC | Add liquidity |
| 8 | Dynamic Fee USDC/EURC | Swap forward |
| 9 | Dynamic Fee USDC/EURC | Remove half |
| 10 | Stable Protection USDC/EURC | Initialize |
| 11 | Stable Protection USDC/EURC | Add liquidity |
| 12 | Stable Protection USDC/EURC | Swap forward |
| 13 | Stable Protection USDC/EURC | Remove half |

So **12 txs minimum** (or 16 if all four approvals fire on first
run); 8–9 txs on a re-run where pools already exist and approvals
are in place.

## Run it

From `contracts/`, with your wallet's private key in scope:

```bash
PRIVATE_KEY=0x<your-private-key-hex> \
  BASE_SEPOLIA_RPC_URL=https://sepolia.base.org \
  forge script script/SepoliaE2E.s.sol \
  --broadcast \
  --rpc-url base_sepolia \
  -vvv
```

The flags:

- `--broadcast` actually sends the txs. Without it, forge just
  simulates locally and prints a trace.
- `--rpc-url base_sepolia` resolves the RPC endpoint via the alias
  in `contracts/foundry.toml` (which itself reads
  `BASE_SEPOLIA_RPC_URL`).
- `-vvv` prints every contract call's trace + logs. Drop to `-vv`
  if you only want the script's own `console2.log` lines and the
  final tx-summary table.

## Output

The script logs every step inline:

```
=== Mantua Sepolia E2E ===
Sender: 0xbaacDCFfA93B984C914014F83Ee28B68dF88DC87
Chain id: 84532
  USDC balance: 326586755
  EURC balance: 17091231
  ETH balance:  170038…

  approved token to spender (tx).
  approved token to spender (tx).
  approved token to spender (tx).
  approved token to spender (tx).

---  no-hook USDC/EURC 0.01% ---
  initialize: tx broadcast.
  add liquidity: tx broadcast.
  swap forward: tx broadcast.
  remove half liquidity: tx broadcast.

…
```

After the run, Foundry writes the broadcast log to
`broadcast/SepoliaE2E.s.sol/84532/run-latest.json` with every tx
hash, gas, and revert info. To see all hashes in one shot:

```bash
jq '.transactions[] | {hash, function, contractAddress}' \
  broadcast/SepoliaE2E.s.sol/84532/run-latest.json
```

## Troubleshooting

**"transferFrom: amount exceeds balance"** — your wallet doesn't have
enough USDC or EURC. The script wants at least ~0.09 of each. Bridge
some Sepolia testnet stablecoins from a faucet.

**"PoolNotInitialized" on add or swap step** — the previous step's
`initialize` got dropped or reverted. Re-run; the script's
`getSlot0` check will detect the existing pool and skip the
re-initialize, but if the issue is RPC flakiness it may take two
runs to land all txs.

**"WrappedError(0xe5e6…20C0, …, AlreadyInitialized())"** — the Stable
Protection hook tracks initialization separately from the
PoolManager. Reading slot0 on the PoolManager doesn't tell us
whether the hook's per-pool config is set. If you've already created
this exact PoolKey on a prior run, this is the symptom; the script
will fail at step 10. Workaround: comment out the Stable Protection
config block in the script for re-runs, or roll back to before the
first run via git stash.

**Cloudflare 502 from the public RPC** — set `BASE_SEPOLIA_RPC_URL`
to a dedicated provider.

## Out of scope (deferred)

- **RWAGate hook config** — requires the wallet to be in the
  on-chain compliance registry first. Add an admin call to register
  the wallet via the registry's operator before running.
- **Async Limit Order hook config** — requires order-encoding
  fixtures we don't have a runner for yet.
- **Agent-side surface** — `/api/agent/swap`, `/api/agent/liquidity`
  go through the CDP-managed agent wallet. Test that path by
  provisioning the agent wallet via the in-app flow, funding it with
  Sepolia ETH, and exercising the agent panel manually. There's no
  scripted runner for the agent surface yet.

These three paths together are the remaining work to fully close
P9-008. They're all known-blocked on the docs above; not engineering
risk, just setup time.

## Wallet sanity checklist before broadcast

- [ ] `forge build script/SepoliaE2E.s.sol` succeeds locally
- [ ] `PRIVATE_KEY` is set in your shell, but **not** committed to
      `.env` or anywhere on disk that's checked into git
      (`server/.env` is gitignored — fine; root `.env` is too)
- [ ] Sepolia ETH balance > 0.05 ETH
- [ ] Sepolia USDC + EURC balance both > 0.5 each
- [ ] `BASE_SEPOLIA_RPC_URL` set to a non-rate-limited endpoint (or
      accept the public endpoint's flakiness)

After the run, link the broadcast log file in your P9-008 closeout
note for the audit trail.

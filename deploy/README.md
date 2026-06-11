# Arc per-hook periphery deploys

Mantua's four hooks were each deployed independently, each against its **own** Uniswap
v4 `PoolManager`, and **none** of the repos deployed the v4 periphery the app needs
(`PositionManager` / `StateView` / `V4Quoter`). These scripts deploy that periphery
against each hook's existing PoolManager so the app can add liquidity, read pool state,
and quote.

Because the four hooks pin **three different, mutually-incompatible v4 versions**, there is
no single unified PoolManager — each deploy is per-repo, in that repo's own v4 version.

| Hook | PoolManager | Script | Status |
|---|---|---|---|
| StableProtection (hero) | `0x15B5…0a59` | `arc-hero-periphery/` | ✅ **deployed** — PositionManager `0x47AD…ab78`, StateView `0x73Bb…3824`, V4Quoter `0xd575…4567` |
| DynamicFee | `0x7eA8…98F0` | `arc-dynamicfee-periphery/` | ✅ verified (compiles + simulates) — ready to deploy |
| ALO | `0x95b7…083b` | `arc-alo-periphery/` | ✅ verified (compiles + simulates) — ready to deploy |
| RWAGate | `0xA29B…D4Dc` | `arc-rwagate-periphery/` | ⚠️ blocked — repo's v4-core/v4-periphery versions are mismatched (see below) |

All scripts: build/run with **`--via-ir --optimizer-runs 200`** (PositionManager needs
via-ir; runs=200 keeps it + PositionDescriptor under the EIP-170 24,576-byte limit). They
do no token transfers, so `forge script` simulation is clean. `run()` returns nothing on
purpose (a returning `run()` breaks `--broadcast` serialization).

> Reminder: never reuse the testnet deployer key you exposed earlier for anything of value.

---

## DynamicFee — `DelleonMcglone/dynamic-fee` (branch `main`)

```bash
cp deploy/arc-dynamicfee-periphery/DeployDynamicFeePeriphery.s.sol /path/to/dynamic-fee/script/
cd /path/to/dynamic-fee
# dry-run (no key, no gas):
forge script script/DeployDynamicFeePeriphery.s.sol:DeployDynamicFeePeriphery \
  --rpc-url https://rpc.testnet.arc.network --via-ir --optimizer-runs 200 \
  --sender 0x000000000000000000000000000000000000dEaD
# real deploy:
forge script script/DeployDynamicFeePeriphery.s.sol:DeployDynamicFeePeriphery \
  --rpc-url https://rpc.testnet.arc.network --via-ir --optimizer-runs 200 \
  --broadcast --private-key 0xYOUR_KEY
```

## ALO — `DelleonMcglone/limit-orders` (branch `master`)

```bash
cp deploy/arc-alo-periphery/DeployAloPeriphery.s.sol /path/to/limit-orders/script/
cd /path/to/limit-orders
forge script script/DeployAloPeriphery.s.sol:DeployAloPeriphery \
  --rpc-url https://rpc.testnet.arc.network --via-ir --optimizer-runs 200 \
  --broadcast --private-key 0xYOUR_KEY
```
> ALO's repo deployed no swap router — if you want swaps on ALO pools you'll also need a
> `PoolSwapTest` on that PoolManager (from v4-core's `test/` dir).

## RWAGate — blocked on version reconciliation

`DeployRWAGatePeriphery.s.sol` is written, but RWAgate's repo can't build periphery for its
own deployed PoolManager:
- Deployed `PoolManager` (`0xA29B…D4Dc`) was built from **v4-core `e50237c`** (older — no
  `PoolOperation.sol`).
- Its `v4-periphery` (`686f621`) targets a **newer** core (`PoolOperation.sol` required;
  its nested core is `59d3ecf5`).

Building the periphery against the newer core would produce contracts that may not be
ABI/storage-compatible with the `e50237c` PoolManager.

**Verified (2026-06-11):** `RWAGate.sol` does NOT compile against the newer core
(`59d3ecf5`) — `Error 7920: Identifier not found or not unique`. The hook builds only
against its original `e50237c`. So a clean redeploy needs the **hook source ported** to a
current v4 API (so it can sit on a PoolManager whose era has usable periphery), or a
v4-periphery whose nested core == `e50237c`. Both are real work; neither is deploy glue.

Options:
1. **Port the hook** to a current v4 version in the RWAgate repo, then it deploys exactly
   like the hero/dynamicfee/alo. Hook-logic surgery + its own tests — best done by the hook
   maintainer.
2. **Find the matching v4-periphery** whose nested core == `e50237c` (version archaeology),
   build periphery against the existing PoolManager.
3. **Defer** (recommended for the demo) — RWAGate is permissioned and least demo-critical;
   ship StableProtection + DynamicFee + ALO, leave RWAGate resolve+gating-only.

When deployed, the RWAGate PositionManager must be **allowlisted** in ComplianceRegistry
`0x2978…556D` (`addToWhitelist(<PositionManager>, 0)`) before it can add liquidity, since
the hook sees the router as `sender`.

---

## After each deploy

Paste the printed **PositionManager / StateView / V4Quoter** back so they can be wired into
the app. Note: making all hooks executable also needs the app's `V4_BY_CHAIN` to become
**per-hook** (each pool routes to its own PoolManager+periphery) — today it holds the single
StableProtection hero stack. DynamicFee/ALO pools also use mock tokens that differ from the
app's registry, so those need token reconciliation too.

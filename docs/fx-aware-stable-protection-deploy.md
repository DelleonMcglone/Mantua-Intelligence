# Phase B — deploy the FX-aware Stable Protection hook (Arc)

Phase A (code) is merged/committed: the hook anchors its circuit breaker to an
owner-set EUR/USD reference, a keeper (`/api/cron/peg-sync`) pushes that reference
from Pyth, and the app opens USDC/EURC at the market price. This runbook does the
on-chain part: redeploy the hook, create + seed the USDC/EURC pool at the FX-fair
price, point the app at the new hook, and turn the keeper on.

**You run steps 1–3 (they need your deployer key + Arc USDC gas). I do step 4.**

## Prerequisites

- A **deployer EOA** with Arc USDC (gas) plus **USDC + EURC** balances to seed the
  pool (e.g. a few hundred of each).
- A **keeper EOA** = the address of `MANTUA_ADMIN_PRIVATE_KEY`. This becomes the
  hook **owner** (only it can `setPegReference`). Fund it with a little USDC so
  the daily cron can send the tiny `setPegReference` tx. It can be the same as the
  deployer, but a dedicated keeper key is cleaner.
- Foundry (`forge`) — already used by the repo.

## 1. Get the current EUR/USD (1e18-scaled)

```bash
curl -s "https://hermes.pyth.network/v2/updates/price/latest?ids[]=a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b&parsed=true" \
  | jq -r '.parsed[0].price | (.price|tonumber) * pow(10; .expo)'
# → e.g. 1.14324  →  EUR_USD_X18 = 1143240000000000000
```

## 2. Deploy + create + seed (from `contracts/hooks/stable-protection`)

Two signers: the funded deployer deploys + seeds; the keeper (hook owner) signs
the owner-only `setPegReference`. The keeper needs only a little USDC (gas).

```bash
cd contracts/hooks/stable-protection
export PRIVATE_KEY=0x<funded-deployer-key>   # USDC gas + USDC & EURC to seed
export KEEPER_PRIVATE_KEY=0x<keeper-key>     # hook owner; = MANTUA_ADMIN_PRIVATE_KEY; needs a little USDC gas
export EUR_USD_X18=1143240000000000000       # from step 1
# export SEED_L=5000000000                   # optional; default 5_000e6
forge script script/DeployArc.s.sol:DeployArc \
  --rpc-url https://rpc.testnet.arc.network --broadcast -vvvv
```

The log prints the new **hook address** (and PoolId). Copy the hook address.

## 3. Hand me the new hook address

Paste the deployed hook address here. I'll:

## 4. Wire the app + go live (I do this)

- Set `HOOK_DEPLOYMENTS_ARC["stable-protection"].hook` in
  `server/src/lib/v4-contracts.ts` to the new address; bump the submodule pointer.
- Confirm Vercel env: `MANTUA_ADMIN_PRIVATE_KEY` (keeper) + `CRON_SECRET` (already
  set); the daily `peg-sync` cron is in `vercel.json`.
- Merge to `main` + deploy.
- Verify: on-chain probe (`quoteExactInputV4` USDC→EURC, 1 USDC now **succeeds**),
  a live USDC↔EURC swap via Stable Protection clears, and `GET /api/cron/peg-sync`
  updates the reference.

## Notes

- The old bricked pool (hook `0xF131…e0C0`, price ~0.66) is abandoned; the new
  hook + pool are canonical. Same Arc "hero" v4 stack (PoolManager/StateView/
  Quoter/PoolSwapTest) is reused — only the hook + pool change.
- `setPegReference` moves no user funds; it only sets the FX reference used for
  depeg detection. The daily refresh keeps the pool well inside the ±5% CRITICAL
  band (EUR/USD barely moves intraday).

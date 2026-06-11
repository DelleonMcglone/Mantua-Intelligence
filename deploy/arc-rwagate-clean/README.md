# RWAGate clean redeploy (hook ported to current v4)

The old RWAGate deployment couldn't get the periphery the app needs: its **v4-core
was `e50237c`** (older — no `PoolOperation.sol`) while its **v4-periphery was
`686f621`** (needs the newer core). So this redeploys the whole RWAGate stack from
**one consistent v4 version** (the periphery's own core, `59d3ecf5`), which required
a tiny port of the hook.

## The port (already applied in your local clone)

`rwagate-v4-port.patch` captures three small changes — verified to compile + the
clean deploy simulates against live Arc:

1. **`src/RWAGate.sol`** — `SwapParams` / `ModifyLiquidityParams` moved out of
   `IPoolManager` into `v4-core/src/types/PoolOperation.sol` in newer v4. Import
   them from there and drop the `IPoolManager.` prefix. (Pure relocation — the
   structs are identical; hook logic unchanged.)
2. **`script/SeedAndSwapArc.s.sol`** — same one-line relocation (so `forge build` is
   clean; this old demo script isn't used by the deploy).
3. **`remappings.txt`** — point `v4-core/` at `lib/v4-periphery/lib/v4-core/`
   (the `59d3ecf5` core) so hook + periphery + PoolManager all build on one version.

To land this in the repo proper: `git apply rwagate-v4-port.patch` from the RWAgate
repo root, then commit.

## Deploy

`DeployRWAGateClean.s.sol` (in your clone's `script/`) deploys a **fresh** stack:
PoolManager + ComplianceRegistry + the ported RWAGate hook (HookMiner'd) + full
periphery (PositionManager/StateView/V4Quoter) + test routers, allowlists the
routers + PositionManager + deployer, and initializes the two canonical RWAGate
pools (USDC/EURC, USDC/cirBTC) at 1:1, fee 0.30%, tickSpacing 60.

```bash
cd /Users/delleonmcglone/RWAgate && forge script script/DeployRWAGateClean.s.sol:DeployRWAGateClean \
  --rpc-url https://rpc.testnet.arc.network --via-ir --optimizer-runs 200 \
  --broadcast --private-key 0xYOUR_KEY
```

Estimated ~0.97 USDC of gas (it deploys a whole stack). Verified: compiles +
simulates clean, all 8 contracts deploy, no EIP-170 size errors.

## Send back

Paste **all** the printed addresses — PoolManager, ComplianceRegistry, RWAGate
(HOOK), PositionManager, StateView, V4Quoter, PoolSwapTest. I wire them into the
app: `RWAGATE_BY_CHAIN` (the new hook address) + `HOOK_DEPLOYMENTS_ARC["rwa-gate"]`
(the new stack). Then `getV4StackForHook` routes RWAGate pools to their periphery
and all four hooks are executable.

> Allowlisting: the deploy whitelists the PositionManager + routers so the app's
> LP/swap (which the hook sees as `sender`) pass the compliance check. To let a
> specific end-user EOA trade directly, the operator calls
> `ComplianceRegistry.addToWhitelist(<address>, 0)`.

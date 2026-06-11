# Arc hero-pool periphery deploy

Deploys the missing Uniswap v4 **periphery** — `PositionManager` (+ `PositionDescriptor`),
`StateView`, `V4Quoter` — against the **already-deployed** Arc Testnet `PoolManager`
`0x15B5f2c054b9DC788250131FCD1bcfCC34080a59` that the **StableProtection** hero pool
(USDC/EURC) uses.

This is the minimum on-chain work needed to make the Mantua app **execute** against the
hero pool: add liquidity (PositionManager), read pool state (StateView), quote swaps
(V4Quoter). Swaps already have a router deployed (`PoolSwapTest 0xeA44…be4d1`).

## Why this is "hero pool first" and not "all four hooks at once"

The four hook repos pin **three different, mutually-incompatible Uniswap v4 versions**
(StableProtection `eeb3eff`, RWAGate `e50237c`+`686f621` with `via_ir=true`/`runs=44.4M`,
DynamicFee & ALO on floating `main` with the newer `PoolOperation.sol` layout and a local
BaseHook). You **cannot** compile all four hooks against one v4 version without porting each
hook's Solidity, so a single unified PoolManager for all four isn't feasible. Each hook
already lives on its **own** PoolManager. To make the others executable, repeat this pattern
in each repo against that repo's own PoolManager + its own pinned v4 version.

## Prerequisites

- A local clone of **`DelleonMcglone/stableprotection-hook`** (branch `main`) with submodules:
  ```bash
  git clone --recurse-submodules https://github.com/DelleonMcglone/stableprotection-hook
  cd stableprotection-hook
  forge install        # if submodules weren't fetched
  ```
- [Foundry](https://book.getfoundry.sh/) installed.
- A funded Arc Testnet deployer (Arc USDC pays gas). RPC `https://rpc.testnet.arc.network`,
  chainId `5042002`, explorer `https://testnet.arcscan.app`.

## Steps

1. Copy `DeployHeroPeriphery.s.sol` into the repo's `script/` folder:
   ```bash
   cp DeployHeroPeriphery.s.sol /path/to/stableprotection-hook/script/
   ```
2. Ensure a `permit2/` remapping exists (v4-periphery vendors it). Check `remappings.txt`;
   if missing, add:
   ```
   permit2/=lib/v4-periphery/lib/permit2/
   ```
3. Compile to confirm version compatibility **before** spending gas:
   ```bash
   forge build --via-ir --optimizer-runs 200
   ```
   > **Why these flags (verified):** v4-periphery's `PositionManager` requires
   > `via_ir`. At the repo's default `optimizer_runs = 800`, via-ir fails on
   > v4-core `Pool.sol` ("stack too deep"); at the canonical high `44444444`,
   > `PositionManager` + `PositionDescriptor` blow past the EIP-170 24,576-byte
   > limit. `optimizer_runs = 200` is the sweet spot: the whole project compiles
   > under via-ir **and** the periphery fits (PositionDescriptor 24,281 / 24,576).
   > Pass these flags on every `forge` command below — do **not** edit
   > `foundry.toml` (the deployed PoolManager + hook used `via_ir=false`/`800`;
   > leave that intact). This only affects the periphery you're deploying now,
   > which uses plain `CREATE` (no salt mining), so bytecode settings are free to differ.

4. Dry-run against the live RPC first (no key, no gas — just proves it executes):
   ```bash
   forge script script/DeployHeroPeriphery.s.sol:DeployHeroPeriphery \
     --rpc-url https://rpc.testnet.arc.network \
     --via-ir --optimizer-runs 200 \
     --sender 0x000000000000000000000000000000000000dEaD
   ```
   Expect "Script ran successfully", four addresses, and no "above contract size
   limit" errors.

5. Deploy for real (no token transfers, so simulation is clean):
   ```bash
   forge script script/DeployHeroPeriphery.s.sol:DeployHeroPeriphery \
     --rpc-url https://rpc.testnet.arc.network \
     --via-ir --optimizer-runs 200 \
     --private-key $DEPLOYER_PRIVATE_KEY \
     --broadcast
   ```
   > Keep `$DEPLOYER_PRIVATE_KEY` in your own shell/`.env` — never commit it.
   > (`export DEPLOYER_PRIVATE_KEY=0x...` first, or paste it inline.) The deployer
   > needs a little Arc USDC for gas (~0.6 USDC estimated).

5. The run prints four addresses (also in `broadcast/DeployHeroPeriphery.s.sol/5042002/run-latest.json`):
   - `PositionManager`
   - `PositionDescriptor` (informational)
   - `StateView`
   - `V4Quoter`

## Hand the addresses back

Paste the **PositionManager**, **StateView**, and **V4Quoter** addresses back to the Mantua
session. They get wired into the app like so:

| Address | App slot |
|---|---|
| PoolManager `0x15B5…0a59` (existing) | `V4_BY_CHAIN[arc].poolManager` |
| PositionManager (new) | `V4_BY_CHAIN[arc].positionManager` + client `getV4PositionManager` |
| StateView (new) | `V4_BY_CHAIN[arc].stateView` |
| V4Quoter (new) | `V4_BY_CHAIN[arc].quoter` |
| PoolSwapTest `0xeA44…be4d1` (existing) | `V4_BY_CHAIN[arc].poolSwapTest` |

After that, the StableProtection USDC/EURC pool is fully executable in the app. The other
three hooks remain resolve + pair-gating only until their stacks get the same treatment
(see `HOOK_DEPLOYMENTS_ARC` in `server/src/lib/v4-contracts.ts`).

## Constructor details (pinned to v4-periphery `eeb3eff`)

```solidity
PositionDescriptor(IPoolManager, address wrappedNative=0, bytes32 label="USDC")
PositionManager(IPoolManager, IAllowanceTransfer permit2, uint256 unsubscribeGasLimit=300000,
                IPositionDescriptor, IWETH9 weth9=0)
StateView(IPoolManager)
V4Quoter(IPoolManager)
```

- **Permit2** `0x000000000022D473030F116dDEE9F6B43aC78BA3` — canonical, same on every chain.
  Confirm it's deployed on Arc; if not, PositionManager still deploys (the address is only
  stored), but permit2-based approval flows would need a fallback.
- **WETH9 = address(0)** — Arc has no canonical WETH; `NativeWrapper` only calls it for
  explicit WRAP/UNWRAP actions, which Arc flows never use.

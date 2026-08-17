# Dynamic Market Hook — Arc Testnet deploy

Deploys the Dynamic Market Hook stack: a dedicated Uniswap v4 `PoolManager`, the
`MarketStateRegistry`, and the hook itself at a mined CREATE2 address.

**Spec:** [`docs/specs/dynamic-market-hook.md`](../../docs/specs/dynamic-market-hook.md)
§37–§42.
**Task:** B2-005.
**Status: NOT DEPLOYED.** The script and the salt mine are written and tested;
the broadcast has not been run because it needs a funded Arc deployer key. Every
address below is blank until it has.

---

## Why the salt mine is the load-bearing step

Uniswap v4 does not store a hook's permissions — it reads them from the hook's
**address**. The low 14 bits are the permission bitmap. So the hook has to be
deployed to an address that already encodes exactly the four callbacks it
implements:

```
BEFORE_INITIALIZE    1 << 13
BEFORE_ADD_LIQUIDITY 1 << 11
BEFORE_SWAP          1 << 7
AFTER_SWAP           1 << 6
                     ------
                     0x28C0
```

The deployed address must satisfy `uint160(addr) & 0x3FFF == 0x28C0`.

`HookMiner.find` brute-forces a CREATE2 salt until the predicted address has
those bits. Because CREATE2 derives the address from
`(proxy, salt, keccak(initcode))` and **not** from the deployer's nonce, the
result is reproducible: same salt and same initcode always give the same
address, on any chain, regardless of deploy order.

**The initcode includes the constructor arguments.** A salt mined against one
`(poolManager, registry)` pair is worthless for another, so the registry and
PoolManager must be deployed _before_ mining. The script does this in order.

This is verified in [`SaltMine.t.sol`](../../contracts/test/hooks/dynamic-market/SaltMine.t.sol),
which mines against the real initcode, deploys through a CREATE2 proxy, and
asserts the deployed address equals the mined one and carries the right bits.

> **Getting this wrong is not recoverable in place.** Adding a callback later
> changes the required bitmap, which changes the address, which means a
> redeploy and re-pointing every pool. The four permissions are fixed before
> deployment, not discovered during it.

---

## Prerequisites

- Foundry, and `contracts/lib/` populated — it is gitignored, so a fresh
  checkout has no dependencies:
  ```bash
  cd contracts && mkdir -p lib
  git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
  git clone --depth 1 https://github.com/transmissions11/solmate lib/solmate
  git clone --depth 1 https://github.com/OpenZeppelin/openzeppelin-contracts lib/openzeppelin-contracts
  git clone --depth 1 https://github.com/Uniswap/v4-core lib/v4-core
  git clone --depth 1 https://github.com/Uniswap/v4-periphery lib/v4-periphery
  (cd lib/v4-core && git submodule update --init --recursive --depth 1)
  (cd lib/v4-periphery && git submodule update --init --recursive --depth 1)
  ```
- An Arc Testnet deployer funded with USDC — Arc uses **USDC as the native gas
  token**, so there is no separate ETH to acquire. Top up at
  <https://faucet.circle.com>.
- Environment:
  ```bash
  export MARKET_OPERATOR=0x...   # registers pools, pauses, rotates roles
  export MARKET_RESOLVER=0x...   # the keeper — same key as the market resolver (spec §0.1)
  ```

---

## Run

```bash
forge script deploy/dynamic-market/DeployDynamicMarket.s.sol \
  --rpc-url https://rpc.testnet.arc.network \
  --broadcast --via-ir --optimizer-runs 200 \
  --verify --verifier blockscout \
  --verifier-url https://testnet.arcscan.app/api
```

`--via-ir --optimizer-runs 200` matches the rest of the repo (spec §39).
Blockscout verification needs no API key (spec §40).

The script asserts the mined address matches the deployed one and that the
permission bits equal `0x28C0`, so a bad deploy fails in the transaction rather
than at the first pool initialize.

---

## Deployment record

Fill in after a successful broadcast. Spec §42 requires every row.

| Field                | Value                             |
| -------------------- | --------------------------------- |
| Chain                | Arc Testnet                       |
| Chain ID             | `5042002`                         |
| RPC                  | `https://rpc.testnet.arc.network` |
| Explorer             | <https://testnet.arcscan.app>     |
| PoolManager          | _not deployed_                    |
| PositionManager      | _not deployed_                    |
| StateView            | _not deployed_                    |
| V4Quoter             | _not deployed_                    |
| PoolSwapTest         | _not deployed_                    |
| MarketStateRegistry  | _not deployed_                    |
| DynamicMarketHook    | _not deployed_                    |
| Deployment salt      | _mined at deploy time_            |
| Hook permission bits | must equal `0x28C0`               |
| Operator             | _`MARKET_OPERATOR`_               |
| Keeper               | _`MARKET_RESOLVER`_ (spec §0.1)   |
| Verification status  | _pending_                         |

> **Periphery is a second step.** This script deploys the `PoolManager` only.
> `PositionManager`, `StateView`, `V4Quoter`, and `PoolSwapTest` follow the same
> pattern as [`deploy/arc-dynamicfee-periphery`](../arc-dynamicfee-periphery)
> against this stack's PoolManager. Until they exist, `getV4StackForHook` will
> throw for this hook rather than route to a half-built stack.

---

## After deploying

1. **Register a market** before initializing its pool — `beforeInitialize`
   rejects an unregistered pool (spec §8):

   ```bash
   cast send $REGISTRY \
     "registerPool(bytes32,uint64,uint64,bool,uint8)" \
     $MARKET_ID $KICKOFF $RESOLUTION $YES_IS_TOKEN0 6 \
     --rpc-url https://rpc.testnet.arc.network
   ```

   - `MARKET_ID` — from `server/src/lib/market-id.ts` (spec §0.4 / B0-004).
   - `YES_IS_TOKEN0` — whether YES sorts below USDC by address. **Getting this
     wrong does not revert**; it inverts every probability the hook reads, so a
     25% market prices as a near-certainty. Compute it, do not guess it.
   - `6` — outcome-token decimals, confirmed in spec §0.1.

2. **Initialize the pool** with `fee = 0x800000` (`DYNAMIC_FEE_FLAG`). A static
   fee is rejected: without the flag the PoolManager ignores the hook's fee
   override and the pool would silently run at a fixed tier.

3. **Feed the keeper state.** Until the first `updateMarket`, the market reads
   as stale, so the fee sits at `MAX_FEE` (5%) and the cap at `MIN_TRADE_CAP`
   ($100). That is the intended fail-closed posture (spec §22), not a bug.

4. **Record addresses** in the table above, then add the entry to
   `HOOK_DEPLOYMENTS_ARC` in `server/src/lib/v4-contracts.ts` and extend
   `HOOK_NAMES` with `"dynamic-market"`. A test in
   `server/src/lib/v4-contracts.test.ts` currently asserts that entry is
   **absent** — update it in the same commit, deliberately.

---

## Keeper permissions

The keeper may write exactly three fields, via one function:

```
updateMarket(poolId, modelProbability, confidence, eventState)
```

Both bps values are bounds-checked before storage and revert above `10_000`. The
keeper cannot register pools, pause, move a kickoff timestamp, change risk
limits, or rotate any role — those are the operator's, and the split is what
contains a compromised keeper (spec §25).

Nothing the keeper writes can breach the immutable bounds in `RiskPolicy`, and
the kickoff freeze reads the registration timestamp, so it fires whether or not
the keeper is alive.

## Fee decomposition event

Every swap emits, for the UI market-adaptation panel (spec §29):

```solidity
event MarketFeeUpdated(PoolId indexed poolId, Breakdown breakdown, uint24 effectiveFee);
```

`Breakdown` carries `baseFee`, `volatilityPremium`, `imbalancePremium`,
`liquidityPremium`, `eventRiskPremium`, `deviationPremium`, and
`directionalAdjustment`. It is emitted as a struct rather than seven flat
parameters so adding a premium later does not change the signature.
